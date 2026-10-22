# Balena operations (database)

Shared records for the partners: purchases, expenses, roasting and production, stock at each
location, ICONSIAM consignment, sales, partner money, approvals and a full change history.
Data lives in the Supabase project `balena-ops` (free plan, Singapore). This is separate from
the public website and from the CheckKhum project.

## How it works

- **Every record is a document** (`documents` + `doc_lines`), created only through
  `post_document()`. The browser never writes ledger tables.
- **Three append-only ledgers**: `stock_moves`, `money_moves`, `partner_moves`. Rows can't be
  edited or deleted; a mistake is fixed with `reverse_document()`, which adds the opposite rows
  and keeps both visible.
- **Approvals**: the owner's records post at once. Others wait for the owner when a limit in
  `settings` is exceeded or not agreed yet (null). ICONSIAM reports, payments, partner money and
  opening balances always wait. `decide_document()` approves or rejects (a reason is required).
- **Costs**: moving weighted average per item (`item_costs`). Roasting needs both weights
  (green in, roasted out) and records the roast loss.
- **Roles**: owner (Thanawat), partner (see all figures, can dispute), staff (production,
  transfers, counts and sales only; no costs or money).
- **History**: `audit_log` stores old and new values for every change, plus approvals,
  reversals, receipts and disputes.

## Files

| Path | What |
|---|---|
| `supabase/migrations/` | Schema, functions, access rules, confirmed reference data |
| `supabase/tests/ledger_test.sql` | End-to-end check (posting, costs, approvals, refusals, access). Rolls itself back. |

## Rules

- Reference data is confirmed facts only: no invented costs, stock, fees or balances. Online
  channel fees stay null until real settlement reports arrive.
- Opening stock and balances are entered as one `opening` record after the partners agree the
  count, and need the owner's approval.
- Members' emails are not kept in the repo; add people from the app.
- Every new table enables row-level security and gets explicit policies.
