import { InputError } from "./events.mjs";

export const BETA_WILLINGNESS_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "not_yet", label: "Not yet" },
];

const allowedWillingness = new Set(BETA_WILLINGNESS_OPTIONS.map((option) => option.value));

export function validateBetaFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Choose an answer before saving feedback.");
  if (!allowedWillingness.has(value.willingness)) throw new InputError("Choose Yes, Maybe, or Not yet.");
  if (typeof value.comment !== "string") throw new InputError("Feedback must be text.");
  const comment = value.comment.trim();
  if (comment.length > 1000) throw new InputError("Keep feedback to 1,000 characters or fewer.");
  return { willingness: value.willingness, comment };
}
