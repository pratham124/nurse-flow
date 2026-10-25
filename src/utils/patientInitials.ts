// Patient initials are kept short so a shift holds as little identifying
// information as possible. The Go API enforces the same limit on save.
export const patientInitialsMaxLength = 2;

// Trims initials and keeps at most the first two characters. Array.from splits
// by character (code point), matching how the server counts, so an accented
// letter or emoji is never cut in half.
export function shortenPatientInitials(initials: string) {
  return Array.from(initials.trim())
    .slice(0, patientInitialsMaxLength)
    .join("");
}
