# A1 Energy Solutions — Backend

This repository is the **backend only** (Express 5 + MongoDB + TypeScript). The
frontend is a sibling repo at `../frontend` (React 19 + Vite + TanStack Router)
with its own `AGENTS.md`.

## Status

- **Phase 1 — Inventory system**: categories (attribute-driven products),
  brands, units, products, FIFO batch stock with immutable movement audit.
- **Phase 2 — Sales & settings (shipped)**: customers, invoices + payments,
  reports, dashboard sales KPIs, business-settings letterhead API.
- Printing/PDF of invoices is the **frontend's** job (A4 + 80mm `@media print`
  + `window.print()`). No backend PDF generation.

## Commands

| Command        | Description                          |
|----------------|--------------------------------------|
| `pnpm dev`     | `node --watch --import tsx src/index.ts` |
| `pnpm build`   | `tsc` → `dist/`                      |
| `pnpm start`   | `node dist/index.js`                 |
| `pnpm lint`    | `pnpm biome check src`               |
| `pnpm lint:fix`| Biome check with autofix             |
| `pnpm format`  | Biome format `src/`                  |

## Conventions

- ESM everywhere (`type: "module"); imports use explicit `.js` extensions:
  `import { x } from "./x.js"`.
- Biome: **tabs** for indentation, **double quotes**, no semicolons.
- Layering: routes define auth/roles/validation; controllers handle HTTP and
  throw `ApiError`; models do all Mongo work and return plain objects.
- Every authenticated route requires the JWT HTTP-only cookie. Roles:
  `ADMIN`, `OWNER`, `STAFF`.
- Response envelope: `{ success, statusCode, data, message }`. Errors:
  `{ success: false, statusCode, errorType, message }` — key is
  **`errorType`**, not `error.type`.
- The API reference is a Swagger UI served at `/api-docs` (raw spec at
  `/api-docs.json`), auto-generated from the Zod schemas in `src/openapi/`
  via `zod-openapi`. When you change a validation or response shape, update
  `src/openapi/schemas.ts` and `src/openapi/paths/*.ts` to match. Domain
  concepts live in [STOCK_MANAGEMENT.md](./STOCK_MANAGEMENT.md) — update it
  when behavior changes.

### TypeScript: `exactOptionalPropertyTypes` is ON

You cannot assign `undefined` to an optional property. Build optional options
conditionally:

```ts
const opts: UpdateOptions = session ? { session } : {};
// or: session ? someUpdate(..., { session }) : someUpdate(..., undefined)
```

This bites everywhere a Mongo operation optionally takes a `session`.

### Money

All money is 2-decimal (`round2`). Formulas:

```
item.total  = qty × unitPrice − line discount
subtotal    = Σ item.total
tax         = (subtotal − invoice.discount) × taxRate / 100
total       = subtotal − discount + tax
balance     = total − paidAmount
revenue     = Σ (subtotal − discount)
cogs        = Σ item.costOfGoodsSold      (FIFO-stamped at confirm)
profit      = revenue − cogs
```

### Transactions

Mongo Atlas is **sharded** (`setName: atlas-…`, `isWritablePrimary: true`), so
transactions work. Use the `withTransaction` helper in `src/db/index.ts`:

```ts
await withTransaction(async (session) => {
  await findInvoiceById(id, session);        // re-read INSIDE the txn
  await consumeBatchesFIFO(session);
  await createMovements(docs, session);
  await markConfirmed(id, items, total, session);
});
```

- **Transactional**: invoice confirm, add payment.
- **Intentionally not transactional** (known, accepted): cancel invoice,
  delete payment. `restoreBatch` is used by cancel.

Race guards:
- Confirm re-checks invoice status **inside** the transaction.
- Payments use `adjustPaidIfPossible` — a conditional
  `findOneAndUpdate({ _id, status: "CONFIRMED", balance: { $gte: amount } })`.
  If it returns `null` a concurrent payment won; the orphan payment is deleted
  and `INVALID_PAYMENT_AMOUNT` thrown.

### Roles

| Operation                          | ADMIN | OWNER | STAFF |
|------------------------------------|:-----:|:-----:|:-----:|
| Read anything                     |  ✔   |  ✔   |  ✔   |
| Create/update invoice, customer, stock | ✔ |  ✔   |  ✔   |
| Confirm/cancel invoice, add payment |  ✔   |  ✔   |  ✔   |
| Create/update product             |  ✔   |  ✔   |  ✘    |
| Create/update category, brand, unit |  ✔   |  ✘   |  ✘    |
| Delete anything (product, stock, invoice, payment, customer) | ✔ | ✘ | ✘ |

One-business model: all auth users see all data. `?owner=` is an optional
accounting filter only. STAFF can read products but not create/update/delete.

### Bootstrap

`src/index.ts` `start()`: load config → `connectDB()` → run all model
`ensureIndexes()` (categories, brands, units, products, stock, stock-batches,
customers, invoices, payments, users) via `Promise.all` → `listen`. Add any new
collection index there.

### Business settings

Singleton document `_id: "business"` in `business_settings`. `GET` (any auth)
returns a defaults template (empty strings) when unset; `PUT` (ADMIN) upserts.
`businessName` is required; optional fields (`email`, `vatNumber`,
`footerNote`, `logoUrl`) may be omitted (left unchanged) — `null` clears a
field via `$unset`. Do NOT use `.default("")` in the Zod schema (it wipes
saved fields on partial PUT).

### Integration testing against live Atlas DB

The user has authorized running ad-hoc scripts against the **same** Atlas DB
(dev environment). Protocol:
- Put throwaway scripts in `/tmp/opencode/*.mjs` and `cp` them into the backend
  dir so `node` resolves `dotenv`/`mongodb`.
- Rebuild first (`pnpm build`), boot `node dist/index.js`, run the script,
  clean up in `finally`, post-verify 0 leftovers, kill the server, remove the
  temp files.
- Never read the `.env` file contents — use `process.env` at runtime only.

## Learnings (pitfalls hit in this repo)

- **Settings `.default("")` bug**: Zod default on optional fields wipes saved
  values on partial PUT. Fix: optional with no default; controller builds the
  input conditionally.
- **`$size` after `$unwind`**: filtering a per-item array field must happen
  before/without `$unwind` collapsing it (invoice + stock models fixed).
- Route is `/stocks` (not `/stock`); unit create requires `symbol`; category
  must pre-define product attributes or create fails `VALIDATION_ERROR`.
- `GET /invoices/:id` wraps the invoice under `d.invoice`; balance/total live
  there. `createdBy.name` on payments is resolved via one `users` lookup.
- Concurrency double-payment test: two parallel payments → one 201 + one 400,
  balance ends at 0, exactly one payment persists.
- Don't commit `.env`; keep `.env.example` in sync (it must stay readable).

## Git

Working tree holds all Phase 2 work (settings files, reports, dashboard,
docs). Commit only when explicitly asked; inspect `git status`/`git diff`
first and never commit secrets.
