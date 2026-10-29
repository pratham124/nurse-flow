package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
)

var (
	// ErrThreadNotFound indicates that the request thread is missing, ended, or
	// not open to the caller. The cases are deliberately indistinguishable.
	ErrThreadNotFound = errors.New("request thread not found")
	// ErrMutationIDReused indicates that a retry identifier was already used for a
	// different request or message body.
	ErrMutationIDReused = errors.New("message retry identifier was already used")
)

// ThreadMessage is one message in a nurse request thread.
type ThreadMessage struct {
	ID               string    `json:"id"`
	ShiftID          string    `json:"shiftId"`
	RequestID        string    `json:"requestId"`
	AuthorProfileID  string    `json:"authorProfileId"`
	Body             string    `json:"body"`
	CreatedAt        time.Time `json:"createdAt"`
	ClientMutationID *string   `json:"clientMutationId"`
}

// TableName maps ThreadMessage to the existing nurse_request_messages table.
func (ThreadMessage) TableName() string { return "public.nurse_request_messages" }

// requireThreadActor checks that the caller may use the request's thread: the
// request exists on an unended shift with a requesting nurse, and the caller is
// the shift's charge owner or is linked to that nurse's slot. Row-level security
// also hides shifts and messages from outsiders; this check mirrors it so the
// error is the same one for every refusal.
func requireThreadActor(tx *gorm.DB, profileID, shiftID, requestID string) error {
	var rows []ActiveShift
	// RLS only shows the owner's shifts and shifts the caller has joined.
	if err := tx.Where("id = ? AND ended_at IS NULL", shiftID).Limit(1).Find(&rows).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		return ErrThreadNotFound
	}
	snapshot, err := shifts.Decode(rows[0].ShiftSnapshot)
	if err != nil {
		return err
	}
	nurseID := snapshot.RequestingNurseID(requestID)
	if nurseID == "" {
		return ErrThreadNotFound
	}
	if rows[0].ChargeProfileID == profileID {
		return nil
	}
	var linked int64
	if err := tx.Table("public.shift_nurse_access").
		Where("shift_id = ? AND nurse_id = ? AND nurse_profile_id = ? AND status = 'linked'", shiftID, nurseID, profileID).
		Count(&linked).Error; err != nil {
		return err
	}
	if linked == 0 {
		return ErrThreadNotFound
	}
	return nil
}

// ListThreadMessages returns a request thread's messages, oldest first.
func (s *Store) ListThreadMessages(ctx context.Context, authID, profileID, shiftID, requestID string) ([]ThreadMessage, error) {
	requestID = strings.TrimSpace(requestID)
	messages := []ThreadMessage{}
	err := s.WithIdentity(ctx, authID, func(tx *gorm.DB) error {
		if err := requireThreadActor(tx, profileID, shiftID, requestID); err != nil {
			return err
		}
		return tx.Where("shift_id = ? AND request_id = ?", shiftID, requestID).Order("created_at, id").Find(&messages).Error
	})
	if err != nil {
		return nil, err
	}
	return messages, nil
}

// AppendThreadMessage stores a message already cleaned by shifts.CleanMessage.
// An empty clientMutationID means the sender cannot retry safely. Sending the
// same identifier, request, and body again is not an error: it returns the saved
// message with duplicate set. The same identifier for anything else fails with
// ErrMutationIDReused.
func (s *Store) AppendThreadMessage(ctx context.Context, authID, profileID, shiftID, requestID, body, clientMutationID string) (message ThreadMessage, duplicate bool, err error) {
	requestID = strings.TrimSpace(requestID)
	var mutationID *string
	if clientMutationID != "" {
		mutationID = &clientMutationID
	}
	err = s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		if err := requireThreadActor(tx, profileID, shiftID, requestID); err != nil {
			return err
		}
		if mutationID != nil {
			saved, found, err := savedMessage(tx, shiftID, profileID, *mutationID)
			if err != nil {
				return err
			}
			if found {
				message, err = compareRetry(saved, requestID, body)
				duplicate = err == nil
				return err
			}
		}
		// Raw: the conflict target names a partial unique index, which the query
		// builder cannot express. id and created_at come from database defaults.
		var inserted []ThreadMessage
		if err := tx.Raw(`
			INSERT INTO public.nurse_request_messages (shift_id, request_id, author_profile_id, body, client_mutation_id)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT (shift_id, author_profile_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL DO NOTHING
			RETURNING id, shift_id, request_id, author_profile_id, body, created_at, client_mutation_id
		`, shiftID, requestID, profileID, body, mutationID).Scan(&inserted).Error; err != nil {
			return err
		}
		if len(inserted) == 1 {
			message = inserted[0]
			return nil
		}
		if mutationID == nil {
			return errors.New("message was not saved")
		}
		// No row came back, so a concurrent send with this identifier committed
		// first. Read it and decide as if it had been there all along.
		saved, found, err := savedMessage(tx, shiftID, profileID, *mutationID)
		if err != nil {
			return err
		}
		if !found {
			return errors.New("message conflict without a saved message")
		}
		message, err = compareRetry(saved, requestID, body)
		duplicate = err == nil
		return err
	})
	if err != nil {
		return ThreadMessage{}, false, err
	}
	return message, duplicate, nil
}

// savedMessage finds the author's earlier message with this retry identifier.
func savedMessage(tx *gorm.DB, shiftID, profileID, mutationID string) (ThreadMessage, bool, error) {
	var rows []ThreadMessage
	if err := tx.Where("shift_id = ? AND author_profile_id = ? AND client_mutation_id = ?", shiftID, profileID, mutationID).Limit(1).Find(&rows).Error; err != nil {
		return ThreadMessage{}, false, err
	}
	if len(rows) == 0 {
		return ThreadMessage{}, false, nil
	}
	return rows[0], true, nil
}

// compareRetry accepts a retry only when it repeats the saved message exactly.
func compareRetry(saved ThreadMessage, requestID, body string) (ThreadMessage, error) {
	if saved.RequestID != requestID || saved.Body != body {
		return ThreadMessage{}, ErrMutationIDReused
	}
	return saved, nil
}
