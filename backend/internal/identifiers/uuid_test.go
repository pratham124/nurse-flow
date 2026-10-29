package identifiers

import "testing"

func TestValidUUID(t *testing.T) {
	for _, test := range []struct {
		name, value string
		want        bool
	}{
		{"lowercase", "abcdef01-2345-4678-9abc-def012345678", true},
		{"uppercase", "ABCDEF01-2345-4678-9ABC-DEF012345678", true},
		{"existing non-v4 fixture", "20000000-0000-0000-0000-000000000001", true},
		{"nil UUID", "00000000-0000-0000-0000-000000000000", true},
		{"empty", "", false},
		{"compact", "abcdef01234546789abcdef012345678", false},
		{"braced", "{abcdef01-2345-4678-9abc-def012345678}", false},
		{"URN", "urn:uuid:abcdef01-2345-4678-9abc-def012345678", false},
		{"spaces", " abcdef01-2345-4678-9abc-def012345678 ", false},
		{"invalid hex", "gbcdef01-2345-4678-9abc-def012345678", false},
		{"misplaced hyphen", "abcdef012-345-4678-9abc-def012345678", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := ValidUUID(test.value); got != test.want {
				t.Fatalf("ValidUUID(%q) = %v, want %v", test.value, got, test.want)
			}
		})
	}
}
