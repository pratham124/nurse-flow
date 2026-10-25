package shifts

import (
	"errors"
	"strings"
	"testing"
)

func TestRequestingNurseID(t *testing.T) {
	snapshot, err := Decode([]byte(`{"nurseRequests":[
		{"id":"q1","requestingNurseId":"n1"},
		{"id":"q2"},
		{"id":"q3","requestingNurseId":""},
		{"id":"q1","requestingNurseId":"n2"}]}`))
	if err != nil {
		t.Fatal(err)
	}
	for id, want := range map[string]string{"q1": "n1", " q1 ": "n1", "q2": "", "q3": "", "missing": "", "": ""} {
		if got := snapshot.RequestingNurseID(id); got != want {
			t.Errorf("RequestingNurseID(%q) = %q, want %q", id, got, want)
		}
	}
	empty, _ := Decode([]byte(`{}`))
	if empty.RequestingNurseID("q1") != "" {
		t.Error("a snapshot without requests has no requesting nurse")
	}
}

func TestCleanMessage(t *testing.T) {
	for _, tt := range []struct {
		name, body, mutation string
		wantBody, wantMut    string
		wantErr              error
	}{
		{"trims both", "  hi  ", " m1 ", "hi", "m1", nil},
		{"blank mutation id means none", "hi", "   ", "hi", "", nil},
		{"blank body", " \n ", "", "", "", ErrMessageBlank},
		{"1000 characters ok", strings.Repeat("é", 1000), "", strings.Repeat("é", 1000), "", nil},
		{"1001 characters", strings.Repeat("é", 1001), "", "", "", ErrMessageTooLong},
		{"120 character id ok", "hi", strings.Repeat("m", 120), "hi", strings.Repeat("m", 120), nil},
		{"121 character id", "hi", strings.Repeat("m", 121), "", "", ErrMutationIDTooLong},
	} {
		t.Run(tt.name, func(t *testing.T) {
			body, mutation, err := CleanMessage(tt.body, tt.mutation)
			if !errors.Is(err, tt.wantErr) || body != tt.wantBody || mutation != tt.wantMut {
				t.Fatalf("got (%q, %q, %v)", body, mutation, err)
			}
		})
	}
}
