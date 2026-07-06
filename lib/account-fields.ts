/**
 * Custom fields for account categories. A category can define a list of
 * labelled fields; each account in the category stores a value per field.
 * Both are persisted as JSON (AccountCategory.customFields / Account.customValues)
 * so no schema change is needed to add a new field. Helpers here defensively
 * parse that JSON on both the server and the client.
 */

export interface CustomFieldDef {
  /** Stable id used as the key in an account's customValues map. */
  id: string;
  label: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Parse a category's customFields JSON into a clean list of field defs. */
export function parseCustomFields(json: unknown): CustomFieldDef[] {
  if (!Array.isArray(json)) return [];
  const out: CustomFieldDef[] = [];
  for (const item of json) {
    if (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      item.label.trim()
    ) {
      out.push({ id: item.id, label: item.label });
    }
  }
  return out;
}

/** Parse an account's customValues JSON into a { fieldId: value } map. */
export function parseCustomValues(json: unknown): Record<string, string> {
  if (!isRecord(json)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** A field def paired with its value, for rendering an account's details. */
export interface CustomFieldValue {
  label: string;
  value: string;
}

/** Zip a category's field defs with an account's stored values (non-empty only). */
export function customFieldValues(
  fieldsJson: unknown,
  valuesJson: unknown,
): CustomFieldValue[] {
  const fields = parseCustomFields(fieldsJson);
  const values = parseCustomValues(valuesJson);
  return fields
    .map((f) => ({ label: f.label, value: values[f.id] ?? "" }))
    .filter((fv) => fv.value.trim().length > 0);
}
