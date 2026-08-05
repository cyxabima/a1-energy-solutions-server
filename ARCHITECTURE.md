# Architecture

## Layering

Requests flow through four layers. Each layer has a single responsibility;
data always moves inward and results always flow back out through the same
path.

```
 HTTP request
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Router  (src/router/*.routes.ts)                          │
│    mounts the route path, chains verifyJwt + authorizeRoles  │
│    + validate(ZodSchema), then the controller handler.       │
│    NOTE: authorizeRoles is applied per-route (not a global)  │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Middlewares (src/middlewares/)                            │
│    verifyJwt       — checks the HTTP-only JWT cookie, sets   │
│                      req.user                                │
│    authorizeRoles  — 403 FORBIDDEN unless role is allowed    │
│    validate        — Zod parse → 400 BAD_REQUEST on failure   │
│    errorHandler    — converts thrown ApiError / unknown       │
│                      errors into the error envelope           │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Controllers (src/controllers/*.controller.ts)             │
│    read req.body / req.query / req.params, call models,      │
│    shape the response envelope via ApiResponse.               │
│    NEVER touch Mongo. Throw ApiError on domain failures.      │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Models (src/models/*.model.ts)                            │
│    all Mongo work: queries, aggregations, writes,             │
│    transactions. Return plain JS objects.                     │
│    `getDb()` from src/db gives the shared client.             │
└─────────────────────────────────────────────────────────────┘
```

Cross-cutting directories:

| Path                 | Responsibility                                  |
|----------------------|-------------------------------------------------|
| `src/db/index.ts`    | Shared `MongoClient`, `getDb()`, `withTransaction` |
| `src/validations/`   | Zod schemas per module (request-body validation) |
| `src/types/`         | Shared TypeScript types                          |
| `src/utils/`         | `ApiError`, `ApiResponse` helpers               |
| `src/config/index.ts`| Parsed env config (throws on missing required)  |

## Request / Response Conventions

### Success

```json
{ "success": true, "statusCode": 200, "data": { ... }, "message": "..." }
```

### Error

```json
{ "success": false, "statusCode": 400, "errorType": "BAD_REQUEST", "message": "..." }
```

- Controllers throw `ApiError(statusCode, errorType, message)`; `errorHandler`
  serializes it. The error key is **`errorType`**, never `error.type`.
- Every `errorType` a route can produce is listed on its Swagger response
  (`/api-docs`, raw spec at `/api-docs.json`).

### Pagination

List endpoints accept `page` (default 1) and `limit` (default 20, **max 100**)
and return `{ items, pagination: { page, limit, total, totalPages } }` (the
items key varies per endpoint, e.g. `movements`, `summary`, `customers`).

### Money

All money fields are 2-decimal (`round2` in `src/models/invoice.model.ts`).
Formulas (revenue, cogs, profit, tax, totals) are documented in
[AGENTS.md](./AGENTS.md#money). Never store or return unrounded money.

## Transactions

`src/db/index.ts` exposes:

```ts
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T>
```

It starts a session, runs `session.withTransaction(fn)`, and always ends the
session in `finally`. Handlers that need a transaction call
`withTransaction(async (session) => { ... })` and thread `session` through each
model call.

**Do:** use the `session ? { session } : {}` pattern when the session is
optional — `exactOptionalPropertyTypes` forbids assigning `undefined` to an
optional `session` option.

**Transactional today:**

- Invoice **confirm**: re-read invoice inside the txn + re-check DRAFT status
  (race guard), then FIFO consumption → movements → `markConfirmed`.
- **Add payment**: `adjustPaidIfPossible` is a conditional
  `findOneAndUpdate({ _id, status: "CONFIRMED", balance: { $gte: amount } })`;
  on `null` (a concurrent payment won) the orphan payment is deleted and
  `INVALID_PAYMENT_AMOUNT` is thrown.

**Intentionally not transactional** (known, accepted trade-off): invoice cancel
(restores batches, non-atomic), payment delete. Any hardening of these should
use the same `withTransaction` pattern.

## Domain Notes

- **One-business model** — all authenticated users share one dataset. `owner`
  on products/stock is attribution only; `?owner=` is an optional filter.
- **Current stock is derived**, never stored: computed from batch
  `remainingQty`, decremented by FIFO consumption. See
  [STOCK_MANAGEMENT.md](./STOCK_MANAGEMENT.md).
- **Invoices**: DRAFT → CONFIRMED (stamps COGS, creates OUT movements) →
  CANCELLED. Only CONFIRMED invoices accept payments; cancel is blocked once
  paid.

## Boot Sequence

`src/index.ts` `start()`:

1. Load config (`src/config/index.ts`).
2. `connectDB()` — build the Mongo client and connect.
3. Run every model `ensureIndexes()` in parallel via `Promise.all`
   (categories, brands, units, products, stock, stock-batches, customers,
   invoices, payments, users).
4. `app.listen(PORT)`.

When adding a new collection index, add it to a model's `ensureIndexes()` —
it is picked up automatically by the bootstrap.
