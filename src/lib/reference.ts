export type CurrencyOption = { code: string; name: string; priority: number };

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "US Dollar", priority: 100 },
  { code: "EUR", name: "Euro", priority: 90 },
  { code: "MXN", name: "Mexican Peso", priority: 80 },
  { code: "ILS", name: "Israeli Shekel", priority: 70 },
  { code: "GBP", name: "British Pound", priority: 0 },
  { code: "CAD", name: "Canadian Dollar", priority: 0 },
  { code: "AUD", name: "Australian Dollar", priority: 0 },
  { code: "CHF", name: "Swiss Franc", priority: 0 },
  { code: "JPY", name: "Japanese Yen", priority: 0 },
  { code: "CNY", name: "Chinese Yuan", priority: 0 },
  { code: "HKD", name: "Hong Kong Dollar", priority: 0 },
  { code: "SGD", name: "Singapore Dollar", priority: 0 },
  { code: "SEK", name: "Swedish Krona", priority: 0 },
  { code: "NOK", name: "Norwegian Krone", priority: 0 },
  { code: "DKK", name: "Danish Krone", priority: 0 },
  { code: "PLN", name: "Polish Zloty", priority: 0 },
  { code: "CZK", name: "Czech Koruna", priority: 0 },
  { code: "HUF", name: "Hungarian Forint", priority: 0 },
  { code: "RON", name: "Romanian Leu", priority: 0 },
  { code: "TRY", name: "Turkish Lira", priority: 0 },
  { code: "INR", name: "Indian Rupee", priority: 0 },
  { code: "BRL", name: "Brazilian Real", priority: 0 },
  { code: "ARS", name: "Argentine Peso", priority: 0 },
  { code: "CLP", name: "Chilean Peso", priority: 0 },
  { code: "COP", name: "Colombian Peso", priority: 0 },
  { code: "ZAR", name: "South African Rand", priority: 0 },
  { code: "AED", name: "UAE Dirham", priority: 0 },
  { code: "SAR", name: "Saudi Riyal", priority: 0 },
  { code: "NZD", name: "New Zealand Dollar", priority: 0 },
  { code: "KRW", name: "South Korean Won", priority: 0 },
  { code: "THB", name: "Thai Baht", priority: 0 },
  { code: "PHP", name: "Philippine Peso", priority: 0 },
  { code: "IDR", name: "Indonesian Rupiah", priority: 0 },
  { code: "MYR", name: "Malaysian Ringgit", priority: 0 },
  { code: "VND", name: "Vietnamese Dong", priority: 0 },
  { code: "UAH", name: "Ukrainian Hryvnia", priority: 0 },
];

export const SORTED_CURRENCIES = [...CURRENCIES].sort(
  (a, b) => b.priority - a.priority || a.code.localeCompare(b.code),
);

export const PAYMENT_CATEGORIES = [
  { key: "supplier", label: "Supplier" },
  { key: "freelancer", label: "Freelancer" },
  { key: "services", label: "Services" },
  { key: "marketing", label: "Marketing" },
  { key: "operations", label: "Operations" },
  { key: "software", label: "Software" },
  { key: "logistics", label: "Logistics" },
  { key: "travel", label: "Travel" },
  { key: "refund", label: "Refund" },
  { key: "other", label: "Other" },
];

export const COUNTRIES = [
  "United States","Canada","Mexico","Israel","United Kingdom","Ireland","Germany","France","Spain",
  "Italy","Portugal","Netherlands","Belgium","Switzerland","Austria","Sweden","Norway","Denmark",
  "Finland","Poland","Czechia","Hungary","Romania","Greece","Turkey","Ukraine","United Arab Emirates",
  "Saudi Arabia","South Africa","India","China","Hong Kong","Singapore","Japan","South Korea",
  "Australia","New Zealand","Brazil","Argentina","Chile","Colombia","Thailand","Philippines",
  "Indonesia","Malaysia","Vietnam","Other",
];

// Countries where IBAN is the standard account identifier.
const IBAN_COUNTRIES = new Set([
  "Israel","United Kingdom","Ireland","Germany","France","Spain","Italy","Portugal","Netherlands",
  "Belgium","Switzerland","Austria","Sweden","Norway","Denmark","Finland","Poland","Czechia",
  "Hungary","Romania","Greece","Turkey","Ukraine","United Arab Emirates","Saudi Arabia",
]);

export type LocalBankField =
  | "routing_number"
  | "sort_code"
  | "branch_number"
  | "clabe"
  | "bsb"
  | "transit_number"
  | "local_clearing_code";

/** Which local clearing fields make sense for a bank country. */
export function localBankFields(country: string | undefined): LocalBankField[] {
  switch (country) {
    case "United States":
      return ["routing_number"];
    case "United Kingdom":
      return ["sort_code"];
    case "Canada":
      return ["transit_number", "branch_number"];
    case "Mexico":
      return ["clabe"];
    case "Australia":
    case "New Zealand":
      return ["bsb"];
    case "Israel":
      return ["branch_number"];
    case "India":
    case "South Africa":
    case "Brazil":
    case "Japan":
    case "China":
      return ["local_clearing_code", "branch_number"];
    default:
      return ["local_clearing_code"];
  }
}

export function ibanExpected(country: string | undefined): boolean {
  return country ? IBAN_COUNTRIES.has(country) : false;
}

export function isValidIban(value: string): boolean {
  const v = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(v);
}

export function isValidSwift(value: string): boolean {
  const v = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
