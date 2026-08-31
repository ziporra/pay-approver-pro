# Staff Identity, Auditability, Bank Directory Architecture

Builds on the existing vendor portal + staff console. Five workstreams.

## 1. Staff accounts & password security

- Provision the four authorized accounts (office@nanoclear.com, bill@nanoclear.com, kim@ziporra.com, info@ed-b.co.il) as individual auth identities, each with its own role row. The temporary password is entered by you once in a secure prompt at provisioning time — it is never written into code, config, migrations, or any table.
- Sign-up self-service is removed. Only pre-provisioned emails can sign in; unknown emails get a clear "not authorized" message.
- Profile gains `must_change_password` and `password_changed_at`. After first login the app forces a password change before the dashboard is reachable.
- Profile → Security → Change Password: requires the current password, never displays any password. Admins can flip `must_change_password` back on to force a reset.

## 2. Profile identity & avatars

- Profile gains `display_name`, `avatar_url`, `avatar_color`, `locale`, `notification_prefs`.
- Deterministic avatar: initial from display name or email prefix, background colour derived by hashing the user id so it is stable forever. Uploaded photo overrides it.
- New `avatars` storage bucket (public read, own-file write) for optional photo upload.
- Top-right profile menu: avatar, name, email, role, then My Profile, Language, Security / Change Password, Notification Preferences, Sign Out.
- New route `/profile` with tabs: Profile, Security, Notifications.

## 3. Identity on every action + activity timeline

- A single append-only `audit_logs` writer used by every staff mutation, capturing actor id, email, display name, role, action type, target payment request / vendor, previous value, new value, and timestamp.
- Sensitive fields (IBAN, account number, SWIFT, PayPal email) are written masked only — `****8521` — never in full.
- Every payment-request detail page gets an Activity Timeline: avatar, name, email, action label, date + time, before/after values.
- Coverage: review, approve, reject, vendor edits, payment edits, banking changes, notes, document uploads, mark paid, payment confirmation upload, invoice received, status changes, manual reminders, cancellation, due date / amount / currency changes, any admin modification.

## 4. Global audit log page

- Admin-only `/audit` route with filters: staff member, action type, vendor, payment request, date range, status, document activity. Paginated, CSV export.
- Table is immutable at the database level for all staff: insert happens through a security-definer writer, and no update/delete policy exists for anyone.

## 5. Banking UX, country & bank selection

- Searchable country selector (flag, name, code, keyboard nav, type-ahead) replacing plain dropdowns in address and bank forms.
- `BankDirectoryProvider` abstraction with a resolution chain: internal cached bank table → external provider if configured → manual fallback. No provider is wired up initially, so the app runs fully on the internal cache + manual entry, and a real directory can be dropped in later without touching the payment flow.
- Bank name autocomplete scoped to the selected country; selecting a known bank fills official name, SWIFT/BIC, country and main address. Branch autocomplete only when reliable branch data exists, otherwise manual entry. No bank, SWIFT code or address is ever fabricated.
- "Can't find your bank? Enter details manually" is always available; those records are flagged `Manually Entered Bank Details`.
- Indicators: `✓ Directory Verified` for directory-sourced public bank identity, `Manual Entry — Payment Team Verification Required` otherwise. Neither claims account ownership is verified.
- Country-specific field sets (IBAN, SWIFT, ABA, sort code, CLABE, BSB, branch/transit code, account number) — only the relevant fields render.
- Format-only validation for IBAN/SWIFT/routing, worded so it never implies the account itself was verified.
- Masking stays enforced: lists, timelines and audit logs show `****4821`; full values only on the authorized payment detail screen, and each reveal is audited.

## 6. Multilingual completion

- All new surfaces (profile, security, notifications, audit log, bank/country selectors, validation and error messages) go through the existing central i18n dictionary — no inline strings.
- Fill out EN / HE / ES / ZH for the whole app including vendor portal, invoice upload and email notification copy.
- Hebrew flips the interface to RTL while numbers, currencies, IBAN and SWIFT stay LTR and readable.
- Language selector in the top nav; preference saved to the staff profile, and preserved in the URL/session for vendor links.

## Technical notes

- New tables/columns: profile fields above, `bank_directory` cache table, bank account flags for entry source and verification, extended `audit_logs`.
- All writes go through authenticated server functions; RLS keeps audit rows readable by staff and writable only by the audit writer.
- Account provisioning uses the admin API in a one-off server call driven by a secure input, not a migration.
