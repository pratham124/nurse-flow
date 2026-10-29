package invites

import (
	"strings"
	"testing"
)

func TestGenerateCodeUsesAlphabetAndLength(t *testing.T) {
	seen := map[string]bool{}
	for range 200 {
		code, err := GenerateCode()
		if err != nil {
			t.Fatal(err)
		}
		if !ValidCode(code) {
			t.Fatalf("generated code %q is not valid", code)
		}
		seen[code] = true
	}
	if len(seen) < 190 {
		t.Fatalf("expected near-unique random codes, got %d distinct of 200", len(seen))
	}
}

func TestNormalizeCode(t *testing.T) {
	for input, want := range map[string]string{
		"k7qx2m":       "K7QX2M",
		"  K7Q-X2M \n": "K7QX2M",
		"k7q\tx 2m":    "K7QX2M",
		"":             "",
	} {
		if got := NormalizeCode(input); got != want {
			t.Errorf("NormalizeCode(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestValidCode(t *testing.T) {
	for code, want := range map[string]bool{
		"K7QX2M":  true,
		"ABCDEF":  true,
		"K7QX2":   false, // too short
		"K7QX2MM": false, // too long
		"K7QX2I":  false, // I is not in the alphabet
		"K7QX20":  false, // 0 is not in the alphabet
		"K7QX2o":  false, // callers must normalize first
		"K7QX2É":  false,
		"":        false,
		"K7Q X2M": false,
	} {
		if got := ValidCode(code); got != want {
			t.Errorf("ValidCode(%q) = %v, want %v", code, got, want)
		}
	}
}

func TestHashCodeNormalizesAndReturnsLowercaseHex(t *testing.T) {
	// SHA-256 of "K7QX2M", the same digest the Expo client produced.
	const want = "457cb8aa83c2da78d213134c351e4533db5b0eced58c6bf99f520d6e8f893b70"
	got := HashCode("k7q-x2m")
	if got != want {
		t.Fatalf("hash = %s, want %s", got, want)
	}
	if got != HashCode("K7QX2M") {
		t.Fatal("hash must be computed from the normalized code")
	}
	if len(got) != 64 || got != strings.ToLower(got) {
		t.Fatalf("hash %q is not 64 lowercase hex characters", got)
	}
}
