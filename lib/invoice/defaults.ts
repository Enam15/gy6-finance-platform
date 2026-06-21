/**
 * GY6's standing invoice details. These pre-fill a new invoice (every field
 * stays editable per invoice). Sourced from the approved invoice design.
 */
export const INVOICE_DEFAULTS = {
  currency: "BDT",
  dueInDays: 7,

  issuerEmail: "team@gy6.io",
  issuerAddress:
    "Rangs Naharz, Suite-11B Shahjalal Avenue, Sector-4 Uttara, Dhaka-1230, Bangladesh",
  issuerPhone: "+8801348095202",

  payBank: "City Bank PLC",
  payAccountName: "GY6",
  payAccountType: "EASY PLUS CR ACCOUNT- BR",
  payAccountNumber: "1255013320001",
  payBranch: "PALLABI BRANCH",
  payRouting: "225263585",

  signatoryName: "Itmam Bashar",
  signatoryTitle: "Co-Founder | GY6",
  signatoryPhone: "+8801762520007",
  signatoryEmail: "itmambashar@gy6.io",
} as const;
