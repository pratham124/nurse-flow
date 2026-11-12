import type { AssignmentInputReason } from "../services/optimizerRepository";

const genericInvalidInputMessage =
  "The server found an invalid assignment setup. Review the nurses, occupied beds, acuity, and load limits before trying again.";

// Adds " (up to 40)" style text only when the server sent the number.
function upTo(limit: number | undefined, suffix = "") {
  return limit === undefined ? "" : ` (up to ${limit}${suffix})`;
}

// Turns one server reason code into a sentence. Unknown codes return undefined
// so a newer server never shows text the app does not understand. The numbers
// always come from the server, so the app never hardcodes a limit.
function describeInputReason(reason: AssignmentInputReason) {
  const { code, limit } = reason;

  switch (code) {
    case "unsupported_room_count":
      return `This floor has more rooms than assignment supports${upTo(limit)}. Remove unused rooms from the floor and try again.`;
    case "unsupported_bed_count":
      return `This floor has more beds than assignment supports${upTo(limit)}. Remove unused beds and try again.`;
    case "unsupported_occupied_bed_count":
      return `There are more patients than assignment supports${upTo(limit, " occupied beds")}.`;
    case "unsupported_nurse_count":
      return `There are more nurses on this shift than assignment supports${upTo(limit)}.`;
    case "unsupported_large_floor_shape":
      return `This floor has too many rooms for its patient count${limit === undefined ? "" : ` (large floors support up to ${limit} rooms)`}. Remove unused rooms and try again.`;
    case "missing_acuity":
      return "Every occupied bed needs an acuity. Set acuity for each patient and try again.";
    case "invalid_max_load":
      return `A nurse's max patient load is higher than this side allows${upTo(limit)}. Lower it and try again.`;
    case "unsupported_side_count":
      return "Assignment needs exactly two doctor sides on this floor.";
    default:
      return undefined;
  }
}

// Builds the full invalid_input message: one sentence per recognized reason (in
// the order received), or the generic text when none are recognized.
export function getInvalidInputMessage(
  reasons: AssignmentInputReason[] | undefined,
) {
  const sentences = (reasons ?? []).flatMap((reason) => {
    const sentence = describeInputReason(reason);
    return sentence ? [sentence] : [];
  });
  const body =
    sentences.length > 0 ? sentences.join(" ") : genericInvalidInputMessage;

  return `${body} No assignment was saved.`;
}
