# AI Invoice Reading (Auto-fill from uploaded invoice)

Add an AI step that reads an uploaded invoice (PDF/JPG/PNG) and fills in as many fields as it can. Anything the AI cannot find stays empty for manual completion, and the existing required-field validation still blocks moving forward until everything mandatory is filled.

## Where it appears

1. **Vendor wizard (public request form)** — a new "Upload invoice and let AI fill the form" option at the very start of the wizard, before the manual steps. The vendor uploads the invoice once; it is reused as the invoice document at the documents step, so no double upload.
2. **Internal staff side** — on the payments screen, a "New request from invoice" action: staff upload an invoice, the AI extracts the data, and a prefilled request form opens for review and submission.

## What the AI extracts

- Invoice details: invoice number, amount, currency, issue date, due date, description, suggested category, PO reference.
- Vendor details: vendor name, beneficiary name, contact name, email, phone, address, city, country, tax/registration number.
- Banking details when printed on the invoice: bank name, bank country, IBAN, account number, SWIFT/BIC, routing/sort code, PayPal email.

## Review and safety rules

- Nothing is saved automatically. Every extracted value lands in the normal form fields, marked with a small "filled by AI" hint that disappears once the user edits the field.
- Fields the AI could not read stay empty and are highlighted as "needs completion". The Next/Submit buttons stay disabled until all mandatory fields are filled — same rules as today.
- **Banking fields always require explicit human confirmation.** AI-extracted bank data is shown side by side with what is already on file, and a checkbox "I verified these payment details against the invoice" must be ticked before it can be used. Changes to IBAN/SWIFT/account/beneficiary/PayPal still trigger the existing "payment details changed" review flag.
- If the invoice matches an existing vendor (by email or tax ID), the wizard links to that vendor instead of creating a duplicate, and only shows what differs.
- If the extraction fails or confidence is low, the user simply continues filling the form manually — no blocking error.

## Technical section

- **Model**: Lovable AI Gateway with a vision-capable model (`google/gemini-2.5-flash`), no extra API key needed. Images sent as image parts; PDFs sent as inline document data, with a text-extraction fallback.
- **Server function** `extractInvoice` in `src/lib/invoice-ai.functions.ts`:
  - Validates mime type and 15 MB size limit with the existing `decodeUpload` helper.
  - Calls the gateway with `tools`/structured output so the response is a strict JSON schema (`invoice`, `vendor`, `bank`, each field with `value` + `confidence`).
  - Returns only the parsed object; the raw file is not persisted by this call.
  - Public (vendor) usage goes through the existing `enforceRateLimit` bucket (e.g. 5 extractions per 10 minutes per IP/email) to keep the anonymous endpoint safe.
  - Staff usage goes through `requireSupabaseAuth`.
  - Handles gateway 429 / 402 by returning a friendly "AI is busy, please fill manually" result instead of throwing.
- **Wizard changes** in `src/routes/request.tsx`: new optional step 0 ("Upload invoice") with a drop zone and progress state; on success the extracted values seed the existing form state, the file is kept in state and attached at the documents step, and a `aiFilled: Set<string>` drives the "filled by AI" hints.
- **Staff entry point**: a dialog on `src/routes/_authenticated/payments.tsx` that runs the same extraction and opens a prefilled internal request form.
- **Audit**: each successful extraction writes an audit event via `write_audit` (`action: 'invoice_ai_extract'`) with the field names filled — never with raw bank values, only masked.
- **DB**: no schema change required; optionally store `extraction_metadata` on `payment_documents` — not included unless wanted.
- **i18n**: new strings added to all four dictionaries (EN, HE, ES, ZH).
