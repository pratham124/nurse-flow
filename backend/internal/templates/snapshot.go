// Package templates validates the reusable floor layout, independently of HTTP and Postgres.
package templates

import (
	"errors"
	"strings"
)

// ErrInvalidLayout indicates missing layout data or inconsistent room/bed references.
var ErrInvalidLayout = errors.New("floor template layout is incomplete or inconsistent")

// Snapshot describes a reusable floor layout copied into a new shift.
type Snapshot struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	DoctorSides []DoctorSide `json:"doctorSides"`
	Rooms       []Room       `json:"rooms"`
	Beds        []Bed        `json:"beds"`
}

// DoctorSide identifies one of the floor's two doctor sides.
type DoctorSide struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Room groups beds under a doctor side and declares their expected count.
type Room struct {
	ID           string `json:"id"`
	DoctorSideID string `json:"doctorSideId"`
	Label        string `json:"label"`
	BedCount     int    `json:"bedCount"`
}

// Bed identifies a numbered bed within a room.
type Bed struct {
	ID        string `json:"id"`
	RoomID    string `json:"roomId"`
	Label     string `json:"label"`
	BedNumber int    `json:"bedNumber"`
}

// Validate checks the completed layout and its references. IDs inside a layout
// remain local strings; only the saved template's ID is a database UUID.
func (s Snapshot) Validate() error {
	if strings.TrimSpace(s.Name) == "" || len(s.DoctorSides) != 2 || len(s.Rooms) == 0 || len(s.Beds) == 0 {
		return ErrInvalidLayout
	}
	sides := make(map[string]bool)
	for _, side := range s.DoctorSides {
		if strings.TrimSpace(side.ID) == "" || strings.TrimSpace(side.Name) == "" || sides[side.ID] {
			return ErrInvalidLayout
		}
		sides[side.ID] = true
	}
	rooms := make(map[string]Room)
	for _, room := range s.Rooms {
		_, duplicate := rooms[room.ID]
		if strings.TrimSpace(room.ID) == "" || strings.TrimSpace(room.Label) == "" || duplicate || !sides[room.DoctorSideID] || room.BedCount < 1 {
			return ErrInvalidLayout
		}
		rooms[room.ID] = room
	}
	bedIDs := make(map[string]bool)
	bedNumbers := make(map[string]map[int]bool)
	for _, bed := range s.Beds {
		room, exists := rooms[bed.RoomID]
		if !exists || strings.TrimSpace(bed.ID) == "" || strings.TrimSpace(bed.Label) == "" || bedIDs[bed.ID] || bed.BedNumber < 1 || bed.BedNumber > room.BedCount {
			return ErrInvalidLayout
		}
		if bedNumbers[bed.RoomID] == nil {
			bedNumbers[bed.RoomID] = make(map[int]bool)
		}
		if bedNumbers[bed.RoomID][bed.BedNumber] {
			return ErrInvalidLayout
		}
		bedIDs[bed.ID] = true
		bedNumbers[bed.RoomID][bed.BedNumber] = true
	}
	for id, room := range rooms {
		if len(bedNumbers[id]) != room.BedCount {
			return ErrInvalidLayout
		}
	}
	return nil
}
