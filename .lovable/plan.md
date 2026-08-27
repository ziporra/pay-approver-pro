# Vendor Payment Request & Approval System — Architecture & Phase 1

## Approach

Build on Lovable Cloud (Postgres + Auth + private file storage + server functions). Phase 1 delivers the secure foundation, the full vendor/payment-request wizard, and the core database. Later automations (reminders, Monday.com, emails, translations) get schema and service seams now, implementation later.

## Roles & access

Roles live in a separate `user_roles` table (never on profiles), checked server-side by a `has_role()` security-definer function used inside every RLS policy.

- Admin — full access, configuration
- Approver — review, approve, reject (Tomer, Info@ed-b.co.il)
- Payment Manager — process approved payments (kim@ziporra.com)
- Accounting — read financial records/documents (bill@nanoclear.com)
- Viewer — read-only
- Vendor — no login at all; only tokenized, expiring links

Vendors never touch the internal app. Every vendor-facing action (submit request, upload invoice) runs through a server function that validates a signed, single-purpose, expiring token — never direct database access from the browser.

## Payment status workflow

```text
Draft -> Submitted -> Awaiting Approval -> Approved -> Awaiting Payment -> Paid
                              |                                     |
                              v                              Awaiting Invoice
                          Rejected                                  |
                                                                Completed
Cancelled reachable from any pre-Paid state
```
Every transition writes a `payment_status_history` row and an audit event. Status changes only happen inside server functions that check the caller's role — never a client-side update.

## Data model

- `profiles`, `user_roles`
- `vendors`, `vendor_contacts`
- `vendor_payment_methods`, `vendor_bank_accounts` (with `pending_review` flag and masked change tracking)
- `payment_requests` (references vendor, plus a **snapshot** of vendor/banking/contact data so history never changes)
- `payment_documents`, `payment_approvals`, `payment_transactions`
- `payment_status_history`, `payment_comments`
- `invoice_reminders`, `notifications`, `email_log`
- `audit_logs`, `monday_sync_logs`
- `app_settings`, `payment_categories`, `currencies`

Money is stored as amount + currency code; no cross-currency totals anywhere — dashboards group per currency.

## Security model

- RLS on every table, deny by default, policies scoped by `has_role()` and ownership.
- Documents in a private bucket; access only via short-lived signed URLs issued after a server-side permission check.
- Bank details returned masked (last 4) to every screen except the approver/payment detail view, which logs each reveal.
- Vendor lookup is a rate-limited server function that takes an exact email or a min-3-character name and returns at most a few minimal matches — no browsing, no enumeration.
- Uploads validated server-side: PDF/JPG/JPEG/PNG only, size cap, content-type sniffing.
- Audit log append-only (no update/delete policy), never containing raw account numbers.
- Any change to IBAN/SWIFT/account/beneficiary/PayPal email flags the vendor `Payment Details Changed`, stores masked before/after, and blocks use until an admin reviews.

## Notification & integration seams (built, not yet wired to providers)

`notifications` + `email_log` tables and a single `notify(event, payload)` server-side service. Events: submitted, approved, rejected, ready-for-payment, completed, invoice missing/reminder/uploaded, vendor details changed. Monday.com sync goes through a queue table (`monday_sync_logs`) so a failed sync never fails a payment; retries are admin-triggered. No banking fields are ever included in the Monday payload.

## i18n architecture

Central dictionary modules (en, he, es, zh) with a typed `t()` hook and a `dir` attribute driven by locale; Hebrew renders RTL. No literal UI strings in components. Phase 1 wires the provider, selector, and English strings, with the other files stubbed for Phase 10.

## Phase 1 scope (this pass)

1. Enable Cloud; migrations for the full schema above with grants, RLS, and audit triggers.
2. Auth (email/password) + role gate; `_authenticated` internal shell with sidebar nav.
3. Vendor-facing 6-step wizard at a tokenized public route: Identify → Contact → Payment Method → Payment Request → Documents → Review & Submit. Conditional PayPal/bank fields, country-aware local banking fields, searchable currency picker (USD/EUR/MXN/ILS pinned), duplicate-vendor detection, duplicate-payment warning, masked review screen, confirmation with `PAY-YYYY-NNNNNN` ID.
4. Internal payments table (search, filters, status badges, due-date urgency) and vendor list/profile pages, read paths only.
5. Design system: sophisticated fintech aesthetic — restrained palette, generous whitespace, refined tables, subtle depth — defined as semantic tokens, mobile-first.

Later passes: approval actions, payment completion, reminders, ledger/dashboard charts, Monday.com, email delivery, remaining languages, security audit.

## Technical notes

Stack is React + TypeScript + Tailwind + shadcn/ui on TanStack Start; all privileged logic in server functions (no client-side authorization). Secrets (Monday token, email API key) stored in the secret store and read only inside handlers.
