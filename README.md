# A1 Energy Solutions — Backend

REST API for the A1 Energy Solutions mini-ERP: metadata-driven inventory
(categories define product attributes), FIFO batch stock tracking, sales
(invoices + payments), financial reports, dashboard KPIs, and business-settings
letterhead data.

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Express 5                           |
| Language    | TypeScript (ESM, `type: module`)    |
| Database    | MongoDB Atlas (v7 driver)           |
| Validation  | Zod 4                               |
| Auth        | JWT via HTTP-only cookies + bcrypt  |
| Package     | pnpm                                |
| Lint/Format | Biome (tabs, double quotes)         |

## Getting Started

Prerequisites: Node.js 20+, pnpm.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Run in development (tsx watch)
pnpm dev
```

Other scripts:

| Command            | Description                              |
|--------------------|------------------------------------------|
| `pnpm build`       | Compile TypeScript to `dist/`            |
| `pnpm start`       | Run the compiled server (`node dist/index.js`) |
| `pnpm lint`        | Biome check on `src/`                    |
| `pnpm lint:fix`    | Biome check with autofix                 |
| `pnpm format`      | Biome format `src/`                      |

## Environment Variables

See `.env.example`. All are required at runtime unless noted.

| Variable       | Default                          | Description                                     |
|----------------|----------------------------------|-------------------------------------------------|
| `PORT`         | `8000`                           | HTTP port                                       |
| `NODE_ENV`     | `development`                    | Runtime environment                             |
| `MONGODB_URI`  | —                                | MongoDB connection string                       |
| `SECRET`       | —                                | JWT signing secret                              |
| `VAT_RATE`     | `0`                              | Default invoice tax rate (percent)              |
| `CORS_ORIGINS` | localhost:5173 + Vercel frontend | Comma-separated allowed origins (see DEPLOYMENT.md) |

> `.env` is git-ignored. Never commit real credentials.

## API

Base URL: `/api/v1`. Health check: `GET /health` (unauthenticated).

Interactive reference (auto-generated from the Zod schemas): start the server
and open [http://localhost:8000/api-docs/](http://localhost:8000/api-docs/) —
Swagger UI backed by the raw spec at `GET /api-docs.json`.

Every authenticated request must carry the JWT (set as the `accessToken`
HTTP-only cookie, or sent as `Authorization: Bearer <token>`). All responses
use the envelope `{ success, statusCode, data, message }`; errors carry an
`errorType` key.

| Module       | Base path        | Notes                                        |
|--------------|------------------|----------------------------------------------|
| Auth         | `/auth`          | register, login, logout, me, password, profile |
| Categories   | `/categories`    | Attribute-driven; tree, attributes, ancestors |
| Brands       | `/brands`        | Standalone entity                            |
| Units        | `/units`         | Standalone entity                            |
| Products     | `/products`      | Belong to a category; name auto-generated    |
| Stocks       | `/stocks`        | FIFO movements, summary, product history     |
| Customers    | `/customers`     | Clients; delete blocked if confirmed invoices|
| Invoices     | `/invoices`      | DRAFT → CONFIRMED, payments, cancel          |
| Payments     | `/payments`      | List + delete (ADMIN)                        |
| Reports      | `/reports`       | Sales, top products, top customers           |
| Dashboard    | `/dashboard`     | `?include=` KPIs incl. sales                 |
| Settings     | `/settings`      | Business letterhead data                     |
| Users        | `/users`         | ADMIN only                                   |

Full endpoint reference: [http://localhost:8000/api-docs/](http://localhost:8000/api-docs/)
(Swagger UI; source in [`src/openapi/`](./src/openapi)).

## Documentation

| Doc                                | Contents                                    |
|------------------------------------|---------------------------------------------|
| Swagger UI (`/api-docs`)           | Endpoint reference, roles, query params, errors |
| [STOCK_MANAGEMENT.md](./STOCK_MANAGEMENT.md) | Stock domain concepts, data flows, frontend integration notes |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, transactions, money policy, boot sequence |
| [DEPLOYMENT.md](./DEPLOYMENT.md)   | Env, CORS, Atlas transaction requirements    |
| [AGENTS.md](./AGENTS.md)           | Conventions and gotchas for agents/devs     |

The frontend lives in the sibling repo
`../frontend` (React 19 + Vite + TanStack Router) and consumes this API.

## Repository Layout

```
src/
├── app.ts             # Express app: cors, cookies, json, /health, /api-docs, /api/v1
├── index.ts           # Boot: config → connectDB → ensureIndexes → listen
├── config/            # Env parsing (PORT, SECRET, VAT_RATE, CORS_ORIGINS…)
├── db/                # Mongo client + withTransaction helper
├── router/            # Route definitions (one per module)
├── controllers/       # HTTP handlers; throw ApiError
├── models/            # Mongo access, aggregations, transactions
├── middlewares/       # verifyJwt, authorizeRoles, validate, errorHandler
├── openapi/           # Swagger spec built from validations (schemas + paths)
├── validations/       # Zod schemas
├── types/             # Shared TS types
└── utils/             # api-error, api-response
```
