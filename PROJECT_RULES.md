# GY6 Finance Management System — Engineering Rules

## Project Philosophy

This is accounting-critical software.

The system must prioritize:
- correctness
- data integrity
- auditability
- scalability
- maintainability
- transactional safety

This is NOT a simple CRUD application.

Treat the system like real financial infrastructure.

---

# CRITICAL ARCHITECTURE RULES

## 1. Income and Expense MUST remain separate

NEVER combine income and expense into a single table.

Required tables:
- income_entries
- expense_entries

They may share reusable logic/services/components, but data storage must remain separate.

---

## 2. Statement Ledger MUST be Immutable

The statement ledger is the official accounting history.

Once a transaction is confirmed and written into statement_entries:
- it cannot be edited directly
- it cannot be deleted directly

Corrections must use:
- reversal entries
- adjustment entries

Never silently overwrite historical financial records.

---

## 3. Double-Entry Bookkeeping Is Mandatory

Every financial transaction must affect two accounts:
- debit account
- credit account

No transaction may exist without linked accounts.

Required fields:
- debit_account_id
- credit_account_id

---

## 4. Never Silently Mutate Balances

Balance changes must ONLY happen through:
- confirmed transactions
- transfers
- balance adjustments

Every balance change must:
- create a statement entry
- create an audit log

Never directly update balances without a traceable ledger event.

---

## 5. Financial Operations Must Use Database Transactions

Use Prisma/PostgreSQL transactions for:
- confirmations
- transfers
- balance adjustments
- renewals
- statement creation
- bulk imports

Prevent partial writes and inconsistent balances.

---

# ACCOUNTING RULES

## Amount Due Formula

amount_due = total_amount - amount_paid

This field is auto-calculated.

Users must never manually edit amount_due.

---

## Status Automation Rules

### If:
confirmed = true

Status:
No Action Required

---

### Else if:
payment_due_on <= 7 days away

Status:
Payment Needed

---

### Else:
Status:
Payment Approaching

---

## Confirmation Rules

When a transaction becomes confirmed:

The system MUST:
1. Set status to "No Action Required"
2. Create immutable statement entry
3. Update linked account balances
4. Create audit log
5. Prevent unsafe editing behavior

---

## Renewal Rules

Recurring transactions must:
- preserve linked accounts
- preserve categories
- preserve recurrence settings

Renewal must:
- create a NEW pending transaction
- reset confirmation
- reset status

Renewal MUST NOT affect balances until confirmation occurs.

---

## Transfer Rules

Transfers must:
- update both accounts
- create statement entries
- create audit logs
- support backdating

Transfers must use double-entry bookkeeping.

---

## Balance Adjustment Rules

Manual balance edits are NOT direct edits.

Every balance correction must:
1. calculate the difference
2. create adjustment ledger entry
3. create audit log
4. preserve historical traceability

Never overwrite balances without adjustment records.

---

# ACCOUNT BALANCE RULES

## Negative Balance Protection

If balance:
- approaches zero
- becomes negative

The system should:
- show warnings
- optionally block operation
- support configurable override permissions

---

## Account Visibility Rules

### Employee Accounts
Balance hidden.

### Subscription Accounts
Balance hidden.

### Client Accounts
Balance visible.

### Founder Accounts
Balance visible.

### Business Accounts
Balance visible.

---

# DATABASE RULES

## Required Core Tables

- income_entries
- expense_entries
- accounts
- statement_entries
- transfers
- balance_adjustments
- attachments
- audit_logs

---

## Statement Table Rules

statement_entries must contain immutable snapshots.

Do NOT rely on live source rows for historical rendering.

Historical records must survive future edits to source records.

---

## Audit Logging Rules

Audit logs are mandatory for:
- confirmations
- transfers
- adjustments
- renewals
- deletions
- exports
- account changes
- category changes

---

# SECURITY RULES

## Role-Based Access Required

Financial data must never be publicly accessible.

Protect:
- API routes
- dashboard routes
- exports
- account balances
- statement data

---

## Sensitive Data Rules

Never expose:
- secrets
- environment variables
- tokens
- raw database credentials

Use environment variables properly.

---

# PERFORMANCE RULES

## Pagination Required

Never load entire statement history at once.

All large datasets must support:
- pagination
- filtering
- sorting
- indexed queries

---

## Optimized Queries

Avoid N+1 query problems.

Use:
- proper Prisma includes
- optimized joins
- indexed searchable fields

---

# UI/UX RULES

The interface should feel:
- calm
- modern
- clean
- easy on the eyes
- uncluttered

Avoid overwhelming dense enterprise UI patterns.

---

## Design Preferences

Use:
- soft shadows
- spacing
- card layouts
- subtle colors
- readable typography
- clean tables

Avoid:
- overly bright colors
- cramped layouts
- excessive modal stacking

---

# ENGINEERING RULES

## Service Layer Architecture Required

Business logic must NOT live directly in components.

Use:
- services
- repositories
- utilities
- validation layers

---

## Validation Requirements

Validate:
- amounts
- dates
- linked accounts
- file uploads
- duplicate confirmations
- invalid transfers
- recurring references

Never trust frontend input.

---

## Type Safety Required

Use strict TypeScript.

Avoid:
- any
- unsafe casts
- weak typing

---

## Reusable Components

Build reusable:
- table systems
- form systems
- status badges
- chart wrappers
- modal components

---

# EXPORT RULES

Statement export must support:
- XLSX
- CSV

Optional:
- PDF

Exports must preserve:
- formatting
- dates
- linked accounts
- transaction references

---

# DASHBOARD RULES

Dashboard must show:
- income
- expenses
- net profit
- charts
- account summaries
- profit distribution

All dashboard values must be real-time.

---

# PROFIT DISTRIBUTION RULES

Profit distribution percentages must be configurable.

DO NOT hardcode shares.

Must support:
- historical tracking
- quarterly distribution
- future scaling

---

# TESTING RULES

Critical systems require tests:
- bookkeeping logic
- balance updates
- transfers
- adjustments
- renewals
- statement creation

---

# CODE QUALITY RULES

Prefer:
- clean architecture
- modular code
- reusable services
- readable naming

Avoid:
- giant files
- duplicated business logic
- deeply nested components
- hardcoded financial logic

---

# FINAL RULE

Correctness is more important than coding speed.

Financial integrity must NEVER be sacrificed for convenience.
