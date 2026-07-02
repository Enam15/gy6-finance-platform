/**
 * Selectable invoice signatories. `key` is stored on the invoice and resolves
 * to the signature image; the text fields pre-fill the signatory block (which
 * stays editable per invoice). Add a preset here + drop the signature PNG in
 * public/invoice to offer another signer.
 */
export interface SignatoryPreset {
  key: string;
  label: string;
  signatureUrl: string;
  name: string;
  title: string;
  phone: string;
  email: string;
}

export const DEFAULT_SIGNATURE_KEY = "itmam";

export const SIGNATORY_PRESETS: SignatoryPreset[] = [
  {
    key: "itmam",
    label: "Itmam Bashar — Co-Founder",
    signatureUrl: "/invoice/signature.png",
    name: "Itmam Bashar",
    title: "Co-Founder | GY6",
    phone: "+8801762520007",
    email: "itmambashar@gy6.io",
  },
  {
    key: "tashfeen",
    label: "Mohammad Tashfeen Zaman — Founder",
    signatureUrl: "/invoice/signature-tashfeen.png",
    name: "Mohammad Tashfeen Zaman",
    title: "Founder | GY6",
    phone: "+8801552352199",
    email: "tashfeenzaman@gy6.io",
  },
];

export function signatureUrlForKey(key: string): string {
  return (
    SIGNATORY_PRESETS.find((p) => p.key === key)?.signatureUrl ??
    "/invoice/signature.png"
  );
}
