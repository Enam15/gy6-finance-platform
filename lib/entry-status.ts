/**
 * Workflow status of an income or expense entry. This is a *computed*
 * property, not a stored column - it depends on the current date, so it is
 * always derived at read time from `confirmed` and `paymentDueOn`.
 */
export type EntryStatus =
  | "NO_ACTION_REQUIRED"
  | "PAYMENT_NEEDED"
  | "PAYMENT_APPROACHING";

/** Days within which an unconfirmed entry switches to PAYMENT_NEEDED. */
export const ENTRY_STATUS_DAYS_THRESHOLD = 7;

/**
 * Derive the workflow status of an entry.
 *
 *   - confirmed             -> NO_ACTION_REQUIRED
 *   - due within threshold  -> PAYMENT_NEEDED   (includes overdue)
 *   - otherwise             -> PAYMENT_APPROACHING
 */
export function computeEntryStatus(
  input: { confirmed: boolean; paymentDueOn: Date },
  now: Date = new Date(),
): EntryStatus {
  if (input.confirmed) return "NO_ACTION_REQUIRED";
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.ceil(
    (input.paymentDueOn.getTime() - now.getTime()) / msPerDay,
  );
  return daysUntilDue <= ENTRY_STATUS_DAYS_THRESHOLD
    ? "PAYMENT_NEEDED"
    : "PAYMENT_APPROACHING";
}
