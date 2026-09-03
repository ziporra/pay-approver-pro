# Vendor Pay Flow

# Context

I need to build a secure internal **Vendor Payment Request & Approval Management System** for our company.

The purpose of the system is to replace our current unorganized payment process with one centralized workflow where:

1. Vendors submit payment requests through a secure link.
2. Existing vendors are recognized automatically.
3. New vendors enter their company, contact and payment details.
4. A designated approver reviews and approves/rejects each payment.
5. Approved payments are forwarded to the person responsible for making the payment.
6. After payment, proof of payment can be uploaded.
7. Vendors must provide an invoice if one has not yet been supplied.
8. The system automatically reminds vendors until the invoice is received.
9. All information is stored in a searchable vendor/payment database.
10. Relevant information should synchronize with Monday.com.
11. Accounting documents and notifications should also be sent to the accounting email.

This is a business-critical financial system, so **security, permissions, audit history, data integrity and privacy are top priorities**.

---

# Primary Users

## 1. Vendor / Payment Requester

A vendor receives a secure payment-request link and submits a payment request.

They do not need access to the internal admin dashboard.

## 2. Payment Approver

Primary approver:

**Tomer Bachar**
Email: **[Info@ed-b.co.il](mailto:Info@ed-b.co.il)**

Tomer receives a notification whenever a new payment request is submitted.

He can:

* Review all request information
* Review vendor details
* Review bank / PayPal information
* Review uploaded invoice or payment demand
* Approve
* Reject
* Add internal notes

If rejected, require a rejection reason.

## 3. Payment Administrator

Payment administrator:

**[kim@ziporra.com](mailto:kim@ziporra.com)**

When Tomer approves a payment, send Kim an email notification containing the complete payment information.

Kim can:

* Review approved requests
* Mark payment as paid
* Enter actual payment date
* Enter actual amount paid
* Enter payment reference / transaction ID
* Upload proof of payment
* Add notes

## 4. Accounting

Accounting email:

**[bill@nanoclear.com](mailto:bill@nanoclear.com)**

Accounting should receive copies / notifications regarding relevant financial events and documents including:

* Payment requests
* Approvals
* Completed payments
* Invoices
* Payment confirmations
* Proof of payment where relevant

Do not expose internal admin-only information unnecessarily in emails.

---

# Main Workflow

## Stage 1 — Vendor Identification

When a vendor opens the payment request link, first ask for:

**Email address**

As the vendor types or submits the email:

* Search the vendor database.
* If a matching vendor exists, identify the vendor automatically.
* Show the vendor/company name and masked summary of saved details.
* Ask:

**“We found your existing vendor profile. Please confirm that your details are still correct.”**

Provide:

* Confirm details
* Update details

Do not expose sensitive bank information unnecessarily.

If the email is not found, allow the vendor to search by:

**Vendor / Company / Beneficiary Name**

Use autocomplete.

If an existing vendor is found, allow them to select themselves and confirm/update information.

If no vendor exists, show:

**Create New Vendor**

---

# New Vendor Form

Collect the following information.

## Company / Vendor Information

Required:

* Vendor / Company Name
* Beneficiary Name / Account Holder Name
* Contact First Name
* Contact Last Name
* Email Address
* Phone Number
* Full Address
* City
* State / Province if applicable
* Postal Code
* Country

Optional:

* Company Registration Number
* VAT / Tax ID
* Internal notes

The system must avoid duplicate vendors.

Before creating a new vendor record, search for possible duplicates by:

* Email
* Company name
* Beneficiary name
* Phone number

If a possible duplicate is found, suggest the existing vendor rather than creating another record.

---

# Payment Method

Ask the vendor to select:

### PayPal

or

### Bank Transfer

---

# PayPal Details

If PayPal is selected, dynamically display:

Required:

* PayPal account email

Optional:

* PayPal payment link
* PayPal account name
* Additional payment instructions

Validate the email format.

---

# Bank Transfer Details

If Bank Transfer is selected, dynamically display the banking form.

Required / supported fields:

### Beneficiary

* Beneficiary / Account Holder Name
* Beneficiary Address
* Beneficiary Country

### Bank

* Bank Name
* Bank Address
* Bank Country
* SWIFT / BIC Code
* Account Number
* IBAN

Because this system will support international payments:

* IBAN must be supported.
* SWIFT/BIC must be supported.
* Some countries do not use IBAN, so do not require IBAN universally.
* Show fields conditionally where appropriate based on country.
* Allow international account formats.
* Validate formats where reliable, without incorrectly blocking legitimate accounts.

Optional additional fields depending on country:

* Routing Number / ABA
* Sort Code
* Branch Number
* CLABE
* BSB
* Transit Number
* Local clearing code
* Intermediary bank details

The UI should only display additional local banking fields when relevant.

---

# Currency

Ask:

**Requested Currency**

Prioritize these currencies at the top:

1. USD — US Dollar
2. EUR — Euro
3. MXN — Mexican Peso
4. ILS — Israeli Shekel

Then provide a searchable list of all commonly supported international currencies.

Display both:

* Currency code
* Currency name

Example:

USD — US Dollar

Allow searching by code or currency name.

---

# Payment Request Details

After vendor/payment details are completed, collect:

* Payment Amount
* Currency
* Payment Description / Purpose
* Invoice Number if available
* Purchase Order / Reference Number if applicable
* Requested Payment Date / Due Date
* Payment category
* Notes

Suggested payment categories:

* Supplier
* Freelancer
* Services
* Marketing
* Operations
* Software
* Logistics
* Travel
* Refund
* Other

Allow administrators to manage categories later.

---

# Required Documentation

Every payment request must include at least one supporting document.

Preferred:

### Invoice

If an invoice is not yet available, allow:

### Payment Request / Proforma / Payment Demand

Require the vendor to specify:

* Invoice attached
* Invoice will be provided after payment

Allow uploads:

* PDF
* JPG
* JPEG
* PNG

Store documents securely.

---

# Submission Confirmation

Before final submission, show a clear summary page containing:

* Vendor
* Contact
* Payment amount
* Currency
* Payment method
* Due date
* Supporting document status

For bank details, mask sensitive values.

Example:

IBAN: **** **** **** 4321

Require checkbox:

**“I confirm that the vendor, banking and payment information above is correct.”**

Then:

**Submit Payment Request**

After submission, create a unique payment request number.

Example:

PAY-2026-000142

Show a confirmation page.

---

# Approval Workflow

Statuses should include:

* Draft
* Submitted
* Awaiting Approval
* Approved
* Rejected
* Awaiting Payment
* Paid
* Awaiting Invoice
* Completed
* Cancelled

Maintain complete status history.

---

# Approval Notification

Immediately after submission:

Send notification to:

**[Info@ed-b.co.il](mailto:Info@ed-b.co.il)**

Subject example:

**New Payment Request Requires Approval — PAY-2026-000142**

Include:

* Vendor
* Amount
* Currency
* Due date
* Payment purpose
* Link to review request

Do not place full bank account details directly in ordinary email if avoidable.

Provide a secure authenticated link to the payment record.

---

# Approver Screen

The approver page should show:

### Payment Summary

* Request ID
* Vendor
* Amount
* Currency
* Requested payment date
* Purpose
* Category

### Vendor Information

### Payment Details

### Supporting Documents

### Previous Vendor History

Show useful context such as:

* Number of previous payments
* Total paid to this vendor
* Last payment date

Actions:

**Approve Payment**

**Reject Payment**

For rejection:

* Require rejection reason
* Optionally notify vendor

Record:

* Who approved/rejected
* Date
* Time
* Notes

---

# Approved Payment Workflow

When Tomer approves:

Change status to:

**Awaiting Payment**

Notify:

**[kim@ziporra.com](mailto:kim@ziporra.com)**

Email should include:

* Payment request ID
* Vendor
* Amount
* Currency
* Due date
* Payment purpose
* Payment method
* Secure link to full payment information

Also send/copy the relevant accounting notification to:

**[bill@nanoclear.com](mailto:bill@nanoclear.com)**

---

# Payment Completion

Kim opens the approved request and selects:

**Mark as Paid**

Require:

* Actual payment date
* Amount paid
* Currency paid
* Payment reference / transaction ID

Optional:

* Upload proof of payment
* Internal note

After saving:

Status becomes:

**Paid**

If an invoice already exists:

Status can become:

**Completed**

If an invoice is still missing:

Status becomes:

**Awaiting Invoice**

---

# Invoice Follow-Up Automation

If payment has been marked as paid but there is no final invoice:

Automatically notify the vendor.

The vendor must be able to either:

1. Upload the invoice directly through a secure upload page

or

2. Send the invoice to:

**[bill@nanoclear.com](mailto:bill@nanoclear.com)**

The secure upload page should work without giving the vendor access to the internal system.

Use a secure, expiring or signed request-specific link.

---

# Invoice Reminder Schedule

After payment:

If the invoice has not been uploaded:

### Days 1–6

Send **one reminder per day**.

### From Day 7 onward

Send **two reminders per day** until the invoice is received.

Stop reminders immediately when:

* Invoice is uploaded
* Administrator marks invoice as received

Add sensible protection against accidental duplicate emails.

Administrators must be able to:

* Pause reminders
* Resume reminders
* Send reminder now
* Mark invoice received manually

---

# Vendor Portal / Invoice Upload

Invoice reminder email should contain:

**Upload Invoice**

Opening the link should show:

* Vendor name
* Payment request number
* Amount paid
* Payment date
* Invoice status

Vendor uploads invoice.

After successful upload:

Show:

**Thank you. Your invoice has been received.**

Send confirmation to:

* Vendor
* [kim@ziporra.com](mailto:kim@ziporra.com)
* [bill@nanoclear.com](mailto:bill@nanoclear.com)

Change request status to:

**Completed**

---

# Vendor Database

Every vendor should automatically receive a permanent internal vendor profile.

Vendor profile should contain:

## Vendor Information

* Vendor name
* Beneficiary
* Contact information
* Address
* Country

## Payment Information

* Preferred payment method
* Bank information or PayPal
* Preferred currency

## Payment History

Table:

* Request ID
* Date
* Amount
* Currency
* Purpose
* Status
* Payment date
* Invoice
* Proof of payment

---

# Vendor Ledger

Create a structured vendor ledger / vendor card.

For each vendor show:

* Total lifetime payments
* Payments this month
* Payments this year
* Number of payments
* Average payment
* Last payment date
* Pending payments
* Awaiting invoice amount/count

Allow filtering by:

* Date
* Month
* Year
* Currency
* Status
* Category

---

# Company Payment Dashboard

Create an internal dashboard.

At the top show cards for:

* Payments awaiting approval
* Payments awaiting payment
* Payments due this week
* Payments overdue
* Paid this month
* Expenses this month
* Missing invoices
* Total payments this month

Include charts for:

### Monthly Expenses

### Expenses by Vendor

### Expenses by Category

### Expenses by Currency

Do not combine different currencies into one financial total without either:

* Currency conversion methodology

or

* separate currency totals.

Default to separate currency totals unless exchange-rate functionality is explicitly configured.

---

# Payments Table

Create a central searchable payments table.

Columns:

* Request ID
* Vendor
* Amount
* Currency
* Category
* Request date
* Due date
* Approver
* Status
* Payment date
* Invoice status

Search:

* Vendor
* Request ID
* Email
* Invoice number
* Payment reference

Filters:

* Status
* Vendor
* Date
* Currency
* Category
* Missing invoice
* Approver

Allow export to:

* CSV
* Excel-compatible format

---

# Monday.com Integration

Integrate the system with Monday.com.

Create/update a Monday item for each payment request.

Recommended Monday fields:

* Payment Request ID
* Vendor
* Contact
* Amount
* Currency
* Payment Method
* Request Date
* Due Date
* Status
* Approver
* Approval Date
* Payment Date
* Invoice Status
* Payment Category
* Internal Link

Synchronize important status changes such as:

* Submitted
* Approved
* Rejected
* Paid
* Invoice Received
* Completed

Design the integration so failed Monday synchronization does **not** cause the payment request itself to fail.

Log synchronization errors and allow administrators to retry.

Never store private banking details directly in Monday.com unless explicitly approved.

---

# Multilingual System

The application must support:

1. English — default
2. Hebrew
3. Spanish
4. Chinese

Create a polished language selector in the header.

Use:

* Language name
* Country/language icon or flag

Examples:

🇺🇸 English
🇮🇱 עברית
🇪🇸 Español
🇨🇳 中文

Important:

Hebrew must use proper **RTL layout**.

English, Spanish and Chinese should use **LTR layout**.

Changing the language must update:

* Navigation
* Forms
* Validation messages
* Status names
* Buttons
* Vendor portal
* Emails where possible

Do not hardcode translated text throughout components.

Use a centralized internationalization architecture.

---

# Authentication & Permissions

This is a private financial system.

Use secure authentication.

Internal users must log in.

Suggested roles:

### Admin

Full access.

### Approver

Can review and approve/reject payments.

### Payment Manager

Can process approved payments.

### Accounting

Can view payment records and documents relevant to accounting.

### Viewer

Read-only access where authorized.

### Vendor

No access to the internal dashboard.

Vendors only receive secure request-specific forms/links.

Implement proper role-based access control.

Do not rely only on hiding buttons in the UI.

Enforce permissions on backend/database operations as well.

---

# Security Requirements

Security is critical.

Use Supabase or an equivalent secure backend for:

* Authentication
* Database
* File storage
* Server-side functions
* Access policies

If using Supabase:

Implement strict Row Level Security policies.

Never expose:

* Service role key
* Private API secrets
* Email service secrets
* Monday.com API tokens

in frontend code.

Use server-side / Edge Functions for sensitive integrations.

Banking information must be treated as highly sensitive.

Requirements:

* HTTPS only
* Secure authentication
* Role-based permissions
* RLS/database security
* Private storage buckets
* Signed URLs where appropriate
* Server-side validation
* Input sanitization
* File type validation
* File size limits
* Rate limiting on public/vendor forms
* Protection against unauthorized enumeration of vendors
* Audit logging
* Session expiration
* Secure secret storage

Do not show a list of all vendors publicly.

Autocomplete must not allow an anonymous person to browse or enumerate the entire vendor database.

Only return the minimum information required for vendor verification.

---

# Audit Log

Every important action must create an audit event.

Include:

* Timestamp
* User
* Role
* Action
* Payment request ID
* Previous status
* New status
* Relevant metadata

Track events such as:

* Request created
* Vendor details updated
* Bank details changed
* Document uploaded
* Request approved
* Request rejected
* Payment marked paid
* Proof uploaded
* Invoice uploaded
* Reminder sent
* Status changed

Banking data should never be written in plaintext into general audit messages.

---

# Sensitive Vendor Detail Changes

If an existing vendor changes:

* Bank account
* IBAN
* SWIFT
* Beneficiary
* PayPal email

flag the vendor profile as:

**Payment Details Changed**

Require internal review before using the changed details for payment.

Show administrators:

* Previous masked value
* New masked value
* Date changed

This is important for protection against payment-detail fraud.

---

# Duplicate Payment Protection

Before submission, detect possible duplicate payment requests.

Check:

* Same vendor
* Same amount
* Same currency
* Same invoice number
* Similar request date

If a possible duplicate exists:

Warn:

**Possible duplicate payment detected.**

Do not automatically reject it, but require review.

---

# Due-Date Intelligence

Show urgency labels:

* Due today
* Due tomorrow
* Due in X days
* Overdue

Dashboard should prioritize payments approaching their due date.

---

# Notifications

Create a notification service rather than hardcoding individual emails throughout the app.

Supported notification events:

* Payment submitted
* Payment approved
* Payment rejected
* Payment ready for payment
* Payment completed
* Invoice missing
* Invoice reminder
* Invoice uploaded
* Vendor details changed

Create email templates that support multiple languages.

Keep an email delivery log:

* Recipient
* Template
* Timestamp
* Status
* Related payment request

---

# UI / UX Direction

The system should feel like a premium modern finance operations platform.

Style:

* Clean
* Professional
* Minimal
* Trustworthy
* High-quality SaaS interface
* Plenty of whitespace
* Clear hierarchy
* Modern cards
* Subtle shadows
* Rounded corners
* Excellent tables and filtering
* Clear status badges
* Strong confirmation screens
* Simple, guided forms

Do not make it look like a generic admin template.

Use a sophisticated financial-operations aesthetic similar to modern fintech SaaS products.

The vendor form should feel extremely easy.

Use a multi-step wizard such as:

### Step 1

Identify Vendor

### Step 2

Contact Information

### Step 3

Payment Method

### Step 4

Payment Request

### Step 5

Documents

### Step 6

Review & Submit

Show a progress indicator.

Autosave where reasonable.

---

# Responsive Design

Build mobile-first.

The vendor submission form must work perfectly on mobile.

Admin dashboard should work on:

* Desktop
* Tablet
* Mobile

Tables may become cards or horizontal-scroll views on smaller screens where appropriate.

Do not sacrifice usability.

---

# Data Model

Design a normalized relational data model.

At minimum consider these entities:

* users
* user_roles
* vendors
* vendor_contacts
* vendor_payment_methods
* vendor_bank_accounts
* payment_requests
* payment_documents
* payment_approvals
* payment_transactions
* invoice_reminders
* notifications
* audit_logs
* monday_sync_logs

Keep vendor master data separate from individual payment requests.

A payment request should reference the vendor and copy/snapshot important payment information required for historical accuracy.

Historical payments must not silently change if the vendor updates banking/contact details later.

---

# Additional Recommended Features

Include these if they fit naturally into the architecture:

### Saved Vendor Search

Fast autocomplete for internal users.

### Favorites / Frequent Vendors

Show frequently used vendors first internally.

### Payment Request Comments

Internal comment thread per request.

### Activity Timeline

Visual chronological timeline of the entire payment.

Example:

Submitted → Approved → Paid → Invoice Received → Completed

### Document Preview

Preview PDF/images without downloading them.

### Expiring Vendor Links

Public vendor links should expire and/or be revocable.

### Payment Confirmation Email

Optionally send the vendor confirmation after payment.

### Admin Configuration

Allow administrators to configure:

* Approvers
* Accounting email
* Reminder frequency
* Payment categories
* Supported currencies
* Email templates

Do not hardcode business settings unnecessarily.

---

# Technical Direction

Preferred stack:

* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Supabase
* Supabase Auth
* Supabase PostgreSQL
* Supabase Storage
* Supabase Edge Functions

Integrations:

* Monday.com API
* Resend or equivalent transactional email provider

Use reusable components and strongly typed data structures.

---

# Implementation Instructions

This is a large system.

**Do not attempt to implement the entire application in one uncontrolled pass.**

Before writing code:

1. Review all requirements.
2. Design the architecture.
3. Define roles and permissions.
4. Define database schema.
5. Define payment status workflow.
6. Define notification/event architecture.
7. Define security model.
8. Define Monday.com synchronization approach.
9. Define multilingual architecture.
10. Define page and component structure.

Then provide a phased implementation plan.

Recommended phases:

### Phase 1

Foundation, database schema, auth, roles and security.

### Phase 2

Vendor onboarding and vendor database.

### Phase 3

Payment request wizard.

### Phase 4

Approval workflow.

### Phase 5

Payment completion workflow.

### Phase 6

Invoice tracking and automatic reminders.

### Phase 7

Vendor ledger and financial dashboard.

### Phase 8

Monday.com integration.

### Phase 9

Email notifications.

### Phase 10

Multilingual support.

### Phase 11

Security audit, responsive QA and final polish.

For the first implementation pass, build only the **foundation + vendor/payment-request UX and core database architecture**.

Do not prematurely implement every automation.

Keep the architecture ready for later phases.

---

# Absolute Constraints

* Do not expose banking data publicly.
* Do not expose secret API keys.
* Do not make the vendor directory publicly enumerable.
* Do not store full banking details in Monday.com.
* Do not allow vendors into the internal admin dashboard.
* Do not rely only on frontend authorization.
* Do not delete audit history.
* Do not overwrite historical payment information when a vendor profile changes.
* Do not mix multiple currencies into misleading totals.
* Do not send duplicate reminders.
* Do not create duplicate vendor records without checking existing vendors first.
* Do not automatically trust changed banking details.

Security and correctness are more important than development speed.

Before coding, provide the architecture and implementation plan first.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pay-approver-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/416e156c-2f08-4ebd-9969-9b7ba4373cb7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
