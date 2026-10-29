package templates

import (
	"encoding/json"
	"testing"
)

const validLayout = `{"id":"local-floor","name":" Floor ","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"r","doctorSideId":"a","label":"101","bedCount":2}],"beds":[{"id":"one","roomId":"r","label":"101-1","bedNumber":1},{"id":"two","roomId":"r","label":"101-2","bedNumber":2}]}`

func TestSnapshotValidation(t *testing.T) {
	tests := []struct {
		name   string
		change func(*Snapshot)
	}{
		{"empty name", func(s *Snapshot) { s.Name = " " }},
		{"missing sides", func(s *Snapshot) { s.DoctorSides = nil }},
		{"duplicate sides", func(s *Snapshot) { s.DoctorSides[1].ID = "a" }},
		{"blank side", func(s *Snapshot) { s.DoctorSides[0].Name = " " }},
		{"missing rooms", func(s *Snapshot) { s.Rooms = nil }},
		{"duplicate rooms", func(s *Snapshot) { s.Rooms = append(s.Rooms, s.Rooms[0]) }},
		{"foreign side", func(s *Snapshot) { s.Rooms[0].DoctorSideID = "missing" }},
		{"empty room ID", func(s *Snapshot) { s.Rooms[0].ID = "" }},
		{"blank room label", func(s *Snapshot) { s.Rooms[0].Label = " " }},
		{"invalid count", func(s *Snapshot) { s.Rooms[0].BedCount = 0 }},
		{"missing beds", func(s *Snapshot) { s.Beds = nil }},
		{"duplicate beds", func(s *Snapshot) { s.Beds[1].ID = "one" }},
		{"blank bed ID", func(s *Snapshot) { s.Beds[0].ID = " " }},
		{"blank bed label", func(s *Snapshot) { s.Beds[0].Label = "" }},
		{"foreign room", func(s *Snapshot) { s.Beds[0].RoomID = "missing" }},
		{"mismatched count", func(s *Snapshot) { s.Rooms[0].BedCount = 3 }},
		{"duplicate bed number", func(s *Snapshot) { s.Beds[1].BedNumber = 1 }},
		{"nonpositive bed number", func(s *Snapshot) { s.Beds[0].BedNumber = 0 }},
		{"out of range bed number", func(s *Snapshot) { s.Beds[1].BedNumber = 3 }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var snapshot Snapshot
			if err := json.Unmarshal([]byte(validLayout), &snapshot); err != nil {
				t.Fatal(err)
			}
			if err := snapshot.Validate(); err != nil {
				t.Fatal("valid layout rejected")
			}
			test.change(&snapshot)
			if snapshot.Validate() != ErrInvalidLayout {
				t.Fatal("malformed layout accepted")
			}
		})
	}
}
