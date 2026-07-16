/**
 * What may still be changed on an income/expense entry, by state. The edit
 * dialog uses this to lock inputs and the services use it to enforce the same
 * rule server-side, so the two cannot drift apart.
 */

export type EntryStateName = "DRAFT" | "CONFIRMED" | "REVERSED";

/**
 * Form fields a posted entry's ledger effect is built from. Confirming copies
 * the account, amount and entry date into an immutable statement entry, and
 * the fee drives the postings a settling payment makes. Changing any of them
 * afterwards would leave the books saying one thing and the entry another, so
 * they are corrected by reversing the entry instead.
 *
 * Description is deliberately absent: the posting keeps the wording it was
 * made with as its historical record, and re-labelling an entry moves no
 * money.
 */
export const POSTED_LOCKED_FIELDS = [
  "accountId",
  "amount",
  "entryDate",
  "fee",
] as const;

export type LockedEntryField = (typeof POSTED_LOCKED_FIELDS)[number];

/** Whether an entry in this state accepts any edit at all. */
export function isEntryEditable(state: EntryStateName): boolean {
  return state === "DRAFT" || state === "CONFIRMED";
}

/** Which form fields are read-only for an entry in this state. */
export function lockedFieldsFor(
  state: EntryStateName,
): readonly LockedEntryField[] {
  return state === "DRAFT" ? [] : POSTED_LOCKED_FIELDS;
}

/** Why the locked fields are locked, phrased for the person editing. */
export const POSTED_LOCK_REASON =
  "This entry is posted to the ledger. Its amount, account, date and fee are " +
  "part of the books and can only be corrected by reversing it. Description, " +
  "category, payment due date and notes stay editable.";
