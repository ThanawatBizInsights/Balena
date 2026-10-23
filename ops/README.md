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
- **Costs**: moving weighted average per item (`item_costs`). Roasting needs both weights
  (green in, roasted out) and records the roast loss.
- **Team**: the app shows no business roles. Every active member uses the same workflow
  (records everything, sees all figures, can flag a record). New members get role `partner` by
  default. The `owner` role is kept in the database as the technical administrator: it manages
  the team and settings, and is the one who approves. The `staff` role still exists in the
  database but the app no longer assigns it.
- **Approvals**: the administrator's own records post at once. Anyone else's purchases,
  expenses, roasts and counts wait when outside the agreed limits (blank limits = always wait);
  imported sales reports, payments, partner money and opening balances always wait. Only the
  administrator approves or rejects; a rejection needs a reason; every decision is in the audit log.
- **Sales report imports** (`import_sales_report`): one record per store report, one line per
  item, with the report number, branch, period, generated date, source file and SHA-256 kept on
  the record. Every line and the report totals are re-checked; any mismatch refuses the import.
  Report + branch + period (+ item code) prevent duplicates; re-importing returns the same record.
  The record is dated at the end of the sales period. Unknown item codes become inactive
  historical products instead of being matched by guesswork. Stock is only deducted when stock
  at that location was recorded before the period; otherwise `stock = not_reconciled`. The
  supplier amount stays "receipt unconfirmed" until a payment record confirms it; no due date is
  invented. Cost is `unavailable`, so no profit is shown.
- **Reporting** (`business_report`): sales, units, discounts, returns, GP/fees, amounts owed and
  received, COGS, expenses and profit for a date range and channel, each with a completeness
  flag. Profit is only returned when every sold line has a known cost and every fee is known.
- **Owner**: identified only by the signed-in login listed in `private.owner_accounts` (not by
  name, member row or browser data). `my_access()` tells the app whether to show owner controls;
  the database enforces every owner-only rule itself. The app can't hand out the owner role.
- **Items and categories**: categories (raw materials with green coffee, roasted coffee inputs,
  finished products with Cold Brew and retail bags, packaging, consumables) each hold one stock
  kind; items move only between categories of the same kind and keep their id. Members add items
  and edit names, pack size, reorder level and barcode through `save_item()`. Category moves,
  code, base unit and entry units, archiving (`archive_item()`) and categories (`save_category()`)
  are owner-only. Permanent removal is an owner-only row rule for items nothing refers to.
  Archived items stay in history and reports but can't be used in new records.
- **Units**: base unit g, mL or pc per item; kg and L built in; packs, rolls or boxes only through
  a conversion set for that item. The server converts (`normalise_lines`) and keeps what was
  typed. Mass is never converted to volume; a used item's base unit can't change.
- **Negative stock**: issues larger than what is on hand are saved and flagged `provisional`;
  the app warns ("สต็อกติดลบชั่วคราว…") without blocking. Negative balances carry no value.
  Signed corrections use an `adjustment` record with a reason (approval for non-owners).
- **Production batches**: output can be recorded first ("materials pending"); materials are
  added later as USE- records (`add_batch_consumption`), never adding the output again; retries
  and identical entries don't duplicate. `complete_batch` sets the batch cost as complete,
  provisional (issued from negative stock) or unknown (a material has no cost) and only a known
  cost updates the product's average. Reversing a material entry reopens the batch.
- **History**: `audit_log` stores old and new values for every change, plus approvals,
  reversals, receipts and disputes.

## Files

| Path | What |
|---|---|
| `supabase/migrations/` | Schema, functions, access rules, confirmed reference data |
| `supabase/tests/ledger_test.sql` | End-to-end check (posting, costs, approvals, refusals, access). Rolls itself back. |
| `supabase/tests/inventory_test.sql` | Items, categories, owner rules, units, negative stock, output-first batches. Fictional data; rolls back. |
| `supabase/tests/import_test.sql` | Import checks (tampered lines, totals, idempotency, approvals, report figures). Fictional data; rolls back. |
| `src/ops/` (repo root) | The app: `overview.tsx`, `report.tsx`, `charts.tsx`, forms, pages, settings. Text in `src/i18n/ops.ts`. |

## Rules

- Reference data is confirmed facts only: no invented costs, stock, fees or balances. Online
  channel fees stay null until real settlement reports arrive.
- Opening stock and balances are entered as one `opening` record after the partners agree the
  count, and need the owner's approval.
- Members' emails are not kept in the repo; add people from the app.
- **This repository is public.** Never commit real sales figures, reports, PDFs or exports; real
  data lives only in Supabase behind row-level security. Tests use fictional figures.
- Every new table enables row-level security and gets explicit policies.
