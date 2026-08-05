# Deployment

## Environment Variables

All variables come from `.env` (loaded via `dotenv`). `.env` is
git-ignored — provision it per environment, never commit secrets.

| Variable       | Production notes                                             |
|----------------|--------------------------------------------------------------|
| `PORT`         | The platform's port (e.g. Vercel injects `PORT`). Default 8000 |
| `NODE_ENV`     | `production` for production runs                              |
| `MONGODB_URI`  | Full Atlas connection string                                  |
| `SECRET`       | A long random JWT signing secret; rotate if ever leaked       |
| `VAT_RATE`     | Default invoice tax rate (percent) if none is set per invoice |
| `CORS_ORIGINS` | Comma-separated allowed origins (see below)                  |

## CORS

`src/config/index.ts` parses `CORS_ORIGINS` as a comma-separated list and
defaults to `http://localhost:5173` plus the Vercel frontend. The Express app
uses `credentials: true`, so **wildcard origins are not allowed** — every
deployment must list its exact origin(s):

```
CORS_ORIGINS=https://hms-frontend-gray-eight.vercel.app,https://your-custom-domain.com
```

## MongoDB Atlas — Transactions Requirement

The API uses multi-document transactions for invoice confirm and add payment.
**Atlas transactions require a sharded cluster** (M0 and shared M2/M5 tiers
won't run them). Verify with:

```sh
mongosh "mongodb+srv://<user>:<pass>@<cluster>/admin" --eval \
  'print(db.adminCommand({ hello: 1 }).setName); print(db.adminCommand({ hello: 1 }).isWritablePrimary)'
```

Expect `setName` starting with `atlas-` and `isWritablePrimary: true`.

Also configure:
- **Network access**: allow the production IP(s), not just local dev.
- **Database user**: scoped credentials for the app (readWrite on the app DB).

## Known Deploy Items

- `MONGODB_URI` currently connects to a database named `test` (boot log
  "Connected to MongoDB: test"). This is intentional for dev only — point the
  production string at a real database name before going live.
- **Serverless/Vercel**: deferred. The app boots a persistent `MongoClient` in
  `src/db/index.ts`, which suits long-running Node processes; a serverless
  deployment needs a connection-pooling strategy (e.g. a lazy singleton client
  or a provider like Mongoose/MongoServerless) and is not yet wired up.

## Run

```bash
pnpm install --prod   # or pnpm install, then:
pnpm build            # tsc → dist/
node dist/index.js    # start
```

Health check (no auth): `GET /health` → `200 { success: true }`.
