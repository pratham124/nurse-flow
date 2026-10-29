package invites

import "time"

// Outcomes of validating or accepting a code.
const (
	StatusValid   = "valid"
	StatusBlocked = "blocked"
	StatusJoined  = "joined"
)

// Stored invite statuses.
const (
	InviteActive  = "active"
	InviteUsed    = "used"
	InviteRevoked = "revoked"
	InviteExpired = "expired"
)

// Reasons an invite code is refused. They match the existing client messages.
const (
	ReasonInvalidFormat         = "invalid_format"
	ReasonNotFound              = "not_found"
	ReasonExpired               = "expired"
	ReasonRevoked               = "revoked"
	ReasonAlreadyUsed           = "already_used"
	ReasonEndedShift            = "ended_shift"
	ReasonStaleNurse            = "stale_nurse"
	ReasonParticipationConflict = "participation_conflict"
)

// UnusableReason checks a found invite in the same order as the original database
// functions: revoked, then used, then expired (by status or by time). It returns
// an empty string when the invite itself can still be used.
func UnusableReason(status string, expiresAt, now time.Time) string {
	switch {
	case status == InviteRevoked:
		return ReasonRevoked
	case status == InviteUsed:
		return ReasonAlreadyUsed
	case status == InviteExpired || !expiresAt.After(now):
		return ReasonExpired
	}
	return ""
}
