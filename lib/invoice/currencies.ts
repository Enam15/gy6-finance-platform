export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

/** Major invoice currencies. `symbol` is what the invoice renders (e.g. Tk, $). */
export const CURRENCIES: CurrencyOption[] = [
  { code: "BDT", label: "BDT — Bangladeshi Taka", symbol: "Tk" },
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "CAD — Canadian Dollar", symbol: "C$" },
  { code: "CHF", label: "CHF — Swiss Franc", symbol: "CHF" },
  { code: "CNY", label: "CNY — Chinese Yuan", symbol: "¥" },
  { code: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { code: "INR", label: "INR — Indian Rupee", symbol: "₹" },
  { code: "SGD", label: "SGD — Singapore Dollar", symbol: "S$" },
  { code: "AED", label: "AED — UAE Dirham", symbol: "AED" },
  { code: "SAR", label: "SAR — Saudi Riyal", symbol: "SAR" },
  { code: "HKD", label: "HKD — Hong Kong Dollar", symbol: "HK$" },
  { code: "NZD", label: "NZD — New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", label: "SEK — Swedish Krona", symbol: "kr" },
  { code: "NOK", label: "NOK — Norwegian Krone", symbol: "kr" },
  { code: "ZAR", label: "ZAR — South African Rand", symbol: "R" },
  { code: "MYR", label: "MYR — Malaysian Ringgit", symbol: "RM" },
  { code: "THB", label: "THB — Thai Baht", symbol: "฿" },
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
