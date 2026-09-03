import { ALLOWED_MIME, MAX_FILE_BYTES } from "./vendor-portal.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export type ExtractedInvoice = {
  invoice_number: string | null;
  amount: string | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  description: string | null;
  category: string | null;
  po_reference: string | null;
  vendor_name: string | null;
  beneficiary_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  registration_number: string | null;
  tax_id: string | null;
  method: "paypal" | "bank_transfer" | null;
  paypal_email: string | null;
  bank_name: string | null;
  bank_address: string | null;
  bank_country: string | null;
  swift_bic: string | null;
  iban: string | null;
  account_number: string | null;
  routing_number: string | null;
  sort_code: string | null;
  branch_number: string | null;
  clabe: string | null;
  bsb: string | null;
  transit_number: string | null;
  local_clearing_code: string | null;
  intermediary_bank: string | null;
};

export type ExtractionResult =
  | { ok: true; fields: ExtractedInvoice; filled: string[] }
  | { ok: false; reason: string };

const FIELD_KEYS: (keyof ExtractedInvoice)[] = [
  "invoice_number",
  "amount",
  "currency",
  "issue_date",
  "due_date",
  "description",
  "category",
  "po_reference",
  "vendor_name",
  "beneficiary_name",
  "contact_first_name",
  "contact_last_name",
  "email",
  "phone",
  "address_line",
  "city",
  "state_province",
  "postal_code",
  "country",
  "registration_number",
  "tax_id",
  "method",
  "paypal_email",
  "bank_name",
  "bank_address",
  "bank_country",
  "swift_bic",
  "iban",
  "account_number",
  "routing_number",
  "sort_code",
  "branch_number",
  "clabe",
  "bsb",
  "transit_number",
  "local_clearing_code",
  "intermediary_bank",
];

const SYSTEM_PROMPT = `You read supplier invoices, proforma invoices and payment demands and extract structured data.
Rules:
- Return ONLY a JSON object, no prose, no markdown fences.
- Use null for anything not clearly printed on the document. Never guess or invent values.
- amount: the total amount payable, digits only with a dot decimal separator, no thousands separators and no currency symbol.
- currency: ISO 4217 three letter code (USD, EUR, ILS, MXN, ...).
- issue_date and due_date: ISO format YYYY-MM-DD.
- country / bank_country: full English country name.
- method: "paypal" only when the document asks to be paid via PayPal, "bank_transfer" when bank details are printed, otherwise null.
- description: one short line describing what is being billed.
- category: one of supplier, freelancer, services, marketing, operations, software, logistics, travel, other.
- Copy bank identifiers (iban, swift_bic, account_number, routing/sort/clabe/bsb codes) exactly as printed, without spaces.
- The vendor is the party issuing the invoice (the payee), never the recipient company.`;

function parseDataUrl(dataUrl: string): { mime: string; base64: string; bytes: number } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid file upload.");
  const mime = match[1]!.toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) throw new Error("Only PDF, JPG and PNG files are accepted.");
  const base64 = match[2]!;
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) throw new Error("File is larger than 15 MB.");
  if (bytes === 0) throw new Error("The uploaded file is empty.");
  return { mime, base64, bytes };
}

function coerce(raw: unknown): ExtractedInvoice {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out = {} as ExtractedInvoice;
  for (const key of FIELD_KEYS) {
    const value = source[key];
    let text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "n/a") text = "";
    (out as Record<string, string | null>)[key] = text ? text : null;
  }
  if (out.method !== "paypal" && out.method !== "bank_transfer") out.method = null;
  if (out.currency) out.currency = out.currency.toUpperCase().slice(0, 3);
  if (out.amount) {
    const numeric = Number(out.amount.replace(/[^0-9.]/g, ""));
    out.amount = Number.isFinite(numeric) && numeric > 0 ? String(numeric) : null;
  }
  for (const key of ["iban", "swift_bic", "account_number", "clabe", "bsb"] as const) {
    if (out[key]) out[key] = out[key]!.replace(/\s+/g, "").toUpperCase();
  }
  return out;
}

/** Send an invoice file to the Lovable AI Gateway and return structured fields. */
export async function extractInvoiceFields(
  fileName: string,
  dataUrl: string,
): Promise<ExtractionResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, reason: "AI reading is not configured. Please fill the form manually." };

  const { mime, base64 } = parseDataUrl(dataUrl);
  const filePart =
    mime === "application/pdf"
      ? {
          type: "file",
          file: { filename: fileName || "invoice.pdf", file_data: `data:${mime};base64,${base64}` },
        }
      : { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };

  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the invoice data as JSON using the required schema." },
              filePart,
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    return { ok: false, reason: "The AI reader is unavailable right now. Please fill the form manually." };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("invoice-ai gateway error", response.status, body.slice(0, 500));
    if (response.status === 429)
      return { ok: false, reason: "The AI reader is busy. Try again in a minute or fill the form manually." };
    if (response.status === 402 || response.status === 403)
      return { ok: false, reason: "AI reading is temporarily unavailable. Please fill the form manually." };
    return { ok: false, reason: "The invoice could not be read automatically. Please fill the form manually." };
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { ok: false, reason: "The invoice could not be read automatically. Please fill the form manually." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { ok: false, reason: "The invoice could not be read automatically. Please fill the form manually." };
  }

  const fields = coerce(parsed);
  const filled = FIELD_KEYS.filter((key) => fields[key] !== null);
  if (filled.length === 0) {
    return { ok: false, reason: "Nothing could be read from this document. Please fill the form manually." };
  }
  return { ok: true, fields, filled };
}

export const SENSITIVE_AI_FIELDS = [
  "iban",
  "account_number",
  "swift_bic",
  "paypal_email",
  "routing_number",
  "sort_code",
  "clabe",
  "bsb",
  "transit_number",
  "branch_number",
  "local_clearing_code",
];
