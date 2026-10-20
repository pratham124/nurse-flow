// Package identifiers validates identifiers shared by authentication and HTTP routes.
package identifiers

import "github.com/google/uuid"

// ValidUUID accepts the dashed UUID format used by the API, in either case.
// The length check excludes the compact, braced, and URN forms the library also accepts.
func ValidUUID(value string) bool {
	return len(value) == 36 && uuid.Validate(value) == nil
}
