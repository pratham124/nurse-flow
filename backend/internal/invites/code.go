// Package invites contains nurse invite-code rules without HTTP or database dependencies.
package invites

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode"
)

const (
	// alphabet omits easily confused characters (I, O, 0, 1). Its length, 32,
	// divides 256, so a random byte modulo 32 picks every character equally often.
	alphabet   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	codeLength = 6
)

// GenerateCode returns a new random invite code using the operating system's
// secure random source.
func GenerateCode() (string, error) {
	random := make([]byte, codeLength)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	code := make([]byte, codeLength)
	for i, b := range random {
		code[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(code), nil
}

// NormalizeCode trims a typed code, removes spaces and dashes, and uppercases it.
func NormalizeCode(code string) string {
	withoutSeparators := strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || r == '-' {
			return -1
		}
		return r
	}, code)
	return strings.ToUpper(withoutSeparators)
}

// ValidCode reports whether an already normalized code has the stored format.
func ValidCode(code string) bool {
	if len(code) != codeLength {
		return false
	}
	for i := range len(code) {
		if !strings.ContainsRune(alphabet, rune(code[i])) {
			return false
		}
	}
	return true
}

// HashCode returns the lowercase hex SHA-256 of the normalized code. Only this
// hash is stored or matched in the database.
func HashCode(code string) string {
	sum := sha256.Sum256([]byte(NormalizeCode(code)))
	return hex.EncodeToString(sum[:])
}
