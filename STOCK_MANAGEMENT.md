# Stock Management System

## Overview

FIFO (First-In-First-Out) inventory tracking with batch-level cost management.
Every stock change is recorded as an immutable audit record. Current stock is
always computed from movements — never stored as a denormalized counter.

Multi-tenancy: products have an `owner`. Non-admin users only see their own
stock. Admins can view and filter across all owners.

---

## Core Concepts

### StockBatch

Created every time stock enters the system (IN or positive ADJUSTMENT).

| Field        | Type     | Description                                    |
|--------------|----------|------------------------------------------------|
| product      | ObjectId | Which product this batch belongs to            |
| buyingPrice  | number   | Cost per unit for this batch                   |
| initialQty   | number   | Quantity when the batch was created            |
| remainingQty | number   | Decremented on each OUT consumption            |
| createdBy    | ObjectId | Who created the batch                          |
| createdAt    | Date     | When the batch was created (FIFO sort key)     |
| updatedAt    | Date     | Last modification time                         |

### StockMovement

An audit record for every stock change.

| Field              | Type              | Description                                      |
|--------------------|-------------------|--------------------------------------------------|
| product            | ObjectId          | Which product                                    |
| quantity           | number            | How many units                                   |
| type               | enum              | IN, OUT, ADJUSTMENT, TRANSFER                    |
| buyingPrice        | number (optional) | Cost per unit — set on IN / positive ADJUSTMENT  |
| salePrice          | number (optional) | Selling price — set on OUT                       |
| reason             | string            | Human-readable explanation                       |
| reference          | string (optional) | External reference                               |
| toOwner            | ObjectId (optional)| Destination user — set on TRANSFER              |
| createdBatchId     | ObjectId (optional)| Which batch was created — set on IN / positive ADJUSTMENT |
| batchConsumutions  | array (optional)  | Which batches were consumed — set on OUT / negative ADJUSTMENT / TRANSFER |
| createdBy          | ObjectId          | Who performed the action                         |
| createdAt          | Date              | When the movement was created                    |
| updatedAt          | Date              | Last modification time                           |

### BatchConsumution

Embedded inside StockMovement for OUT-type movements.

| Field        | Type     | Description                            |
|--------------|----------|----------------------------------------|
| batchId      | ObjectId | Which batch was consumed               |
| quantity     | number   | How much was taken from this batch     |
| buyingPrice  | number   | Cost at time of consumption (snapshot) |

---

## Movement Types

### IN (Purchase)

Stock enters the system. Creates a batch.

- Requires: `product`, `quantity`, `buyingPrice`, `reason`
- Creates: 1 StockBatch + 1 StockMovement (type = "IN")
- Movement has `createdBatchId` pointing to the new batch
- Example: "Bought 100 solar panels at $50 each from Supplier X"

### OUT (Sale)

Stock leaves the system. Consumes batches via FIFO.

- Requires: `product`, `quantity`, `salePrice`, `reason`
- Creates: 1 StockMovement (type = "OUT")
- Movement has `batchConsumutions[]` listing what was consumed
- Example: "Sold 30 panels to Customer Y"
- FIFO might consume: 30 from batch A ($50), or 20 from A + 10 from B if batch A only has 20 left

### ADJUSTMENT (Correction)

Stock correction. Direction determines behavior.

- Requires: `product`, `quantity`, `reason`
- Positive quantity: creates batch + movement (like IN). Also requires `buyingPrice`.
- Negative quantity: consumes via FIFO + movement (like OUT)
- Example: +5 "Found 5 units in back room", -3 "3 units damaged"

### TRANSFER (Owner-to-Owner)

Stock moves between owners. Consumes batches from source owner.

- Requires: `product`, `quantity`, `toOwner`, `reason`
- Consumes: batches via FIFO
- Creates: 1 StockMovement (type = "OUT", with `toOwner` field)
- Example: "Transfer 20 panels from Owner A to Owner B"
- Note: Only one OUT movement is created. No corresponding IN on the destination.

---

## Data Flow Diagrams

### Stock IN

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /stocks/  { type: "IN", product, quantity, buyingPrice }   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Create StockBatch     │
              │  product: product      │
              │  buyingPrice: 50       │
              │  initialQty: 100       │
              │  remainingQty: 100     │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Create StockMovement  │
              │  type: "IN"            │
              │  quantity: 100         │
              │  buyingPrice: 50       │
              │  createdBatchId: ──────────► batch._id
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Return movement       │
              └────────────────────────┘
```

### Stock OUT (FIFO)

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /stocks/  { type: "OUT", product, quantity, salePrice }    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  consumeBatchesFIFO()  │
              └───────────┬────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │  Find batches for product          │
         │  where remainingQty > 0            │
         │  sort by createdAt ASC (oldest)    │
         └───────────────┬────────────────────┘
                         │
                         ▼
         ┌────────────────────────────────────┐
         │  Check total remaining >= quantity │
         │  else throw INSUFFICIENT_STOCK     │
         └───────────────┬────────────────────┘
                         │
                         ▼
         ┌────────────────────────────────────┐
         │  Walk batches, consume from each:  │
         │                                    │
         │  Batch A: remaining=50, take 30    │
         │    → remaining becomes 20          │
         │    → consumption: {A, 30, $50}     │
         │                                    │
         │  Batch B: remaining=40, take 0     │
         │    (already fulfilled)             │
         └───────────────┬────────────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │  Create StockMovement  │
              │  type: "OUT"           │
              │  quantity: 30          │
              │  salePrice: 75         │
              │  batchConsumutions:    │
              │    [{ batchId: A,      │
              │       qty: 30,         │
              │       buyingPrice: 50 }]│
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Return movement       │
              └────────────────────────┘
```

### Stock TRANSFER

```
┌──────────────────────────────────────────────────────────────────────┐
│  POST /stocks/  { type: "TRANSFER", product, quantity, toOwner }     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Validate toOwner      │
              │  (must exist in users) │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  consumeBatchesFIFO()  │
              │  (same as OUT)         │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Create StockMovement  │
              │  type: "OUT"           │
              │  quantity: 20          │
              │  toOwner: targetUser   │
              │  reason: "Transfer     │
              │    to Target User"     │
              │  batchConsumutions:    │
              │    [{ ... }]           │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Return movement       │
              └────────────────────────┘
```

### Delete IN Movement

```
┌──────────────────────────────────────────────────────────────────┐
│  DELETE /stocks/:id                                              │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Find movement by ID   │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Is type IN or         │
              │  positive ADJUSTMENT?  │
              └─────┬──────────┬───────┘
                    │          │
                   YES         NO
                    │          │
                    ▼          │
         ┌──────────────────┐  │
         │ Find batch by    │  │
         │ createdBatchId   │  │
         └────────┬─────────┘  │
                  │            │
                  ▼            │
         ┌──────────────────┐  │
         │ batch.remaining  │  │
         │ Qty < initialQty?│  │
         └───┬──────────┬───┘  │
             │          │      │
            YES         NO     │
             │          │      │
             ▼          │      │
    ┌────────────────┐  │      │
    │ BLOCK: 400     │  │      │
    │ BATCH_CONSUMED │  │      │
    │ "Cannot delete │  │      │
    │  batch has     │  │      │
    │  been consumed"│  │      │
    └────────────────┘  │      │
                        │      │
                        ▼      │
              ┌────────────────┐
              │  Delete batch  │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  Delete        │
              │  movement      │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  Return success│
              └────────────────┘
```

### Delete OUT Movement

```
┌──────────────────────────────────────────────────────────────────┐
│  DELETE /stocks/:id                                              │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Find movement by ID   │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Has batchConsumutions?│
              └─────┬──────────┬───────┘
                    │          │
                   YES         NO
                    │          │
                    ▼          │
         ┌──────────────────┐  │
         │ For each entry:  │  │
         │ restoreBatch()   │  │
         │ → increment      │  │
         │   remainingQty   │  │
         └────────┬─────────┘  │
                  │            │
                  ▼            │
              ┌────────────────┐
              │  Delete        │
              │  movement      │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  Return success│
              └────────────────┘
```

---

## API Reference

### POST /stocks/

Create a stock movement.

**Roles:** ADMIN, OWNER, STAFF

**Request body by type:**

```jsonc
// IN
{
  "product": "productId",
  "quantity": 100,
  "type": "IN",
  "buyingPrice": 50,              // required
  "reason": "Purchase from Supplier X",
  "reference": "PO-001"           // optional
}

// OUT
{
  "product": "productId",
  "quantity": 30,
  "type": "OUT",
  "salePrice": 75,                // required
  "reason": "Sale to Customer Y",
  "reference": "INV-001"          // optional
}

// ADJUSTMENT (positive)
{
  "product": "productId",
  "quantity": 5,
  "type": "ADJUSTMENT",
  "buyingPrice": 50,              // required for positive
  "reason": "Found 5 units in back room"
}

// ADJUSTMENT (negative)
{
  "product": "productId",
  "quantity": -3,
  "type": "ADJUSTMENT",
  "reason": "3 units damaged"
}

// TRANSFER
{
  "product": "productId",
  "quantity": 20,
  "type": "TRANSFER",
  "toOwner": "targetUserId",      // required
  "reason": "Restock for second location"
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "...",
    "product": "productId",
    "quantity": 100,
    "type": "IN",
    "buyingPrice": 50,
    "reason": "Purchase from Supplier X",
    "reference": "PO-001",
    "createdBatchId": "batchId",
    "batchConsumutions": null,
    "createdBy": "userId",
    "createdAt": "2026-07-17T...",
    "updatedAt": "2026-07-17T..."
  },
  "message": "Stock movement recorded successfully"
}
```

---

### GET /stocks/

List stock movements with filtering and pagination.

**Roles:** Any authenticated user (non-admins scoped to own products)

**Query params:**

| Param   | Type   | Default | Description                          |
|---------|--------|---------|--------------------------------------|
| search  | string | —       | Filter by reason (case-insensitive)  |
| product | string | —       | Filter by product ID                 |
| type    | string | —       | Filter by movement type              |
| owner   | string | —       | Admin only: filter by product owner  |
| page    | number | 1       | Page number                          |
| limit   | number | 20      | Items per page (max 100)             |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "_id": "...",
        "product": {
          "_id": "...",
          "name": "Solar Panel 400W",
          "barcode": "A1E-000001"
        },
        "quantity": 100,
        "type": "IN",
        "buyingPrice": 50,
        "salePrice": null,
        "reason": "Purchase from Supplier X",
        "reference": "PO-001",
        "toOwner": null,
        "createdBatchId": "...",
        "batchConsumutions": null,
        "createdBy": {
          "_id": "...",
          "name": "Admin User"
        },
        "createdAt": "2026-07-17T..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "Stock movements fetched successfully"
}
```

---

### GET /stocks/summary

Aggregated stock summary per product with inventory valuation.

**Roles:** Any authenticated user (non-admins scoped to own products)

**Query params:**

| Param    | Type   | Default | Description                          |
|----------|--------|---------|--------------------------------------|
| search   | string | —       | Filter by product name               |
| category | string | —       | Filter by category ID                |
| brand    | string | —       | Filter by brand ID                   |
| owner    | string | —       | Admin only: filter by product owner  |
| lowStock | string | —       | "true" for stock <= 0, or a number (e.g., "10") for stock <= that threshold |
| page     | number | 1       | Page number                          |
| limit    | number | 20      | Items per page (max 100)             |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": [
      {
        "_id": "productId",
        "name": "Solar Panel 400W",
        "barcode": "A1E-000001",
        "category": "categoryId",
        "brand": "brandId",
        "unit": "unitId",
        "owner": "ownerId",
        "currentStock": 70,
        "totalValue": 3500
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  },
  "message": "Stock summary fetched successfully"
}
```

`currentStock` = computed from movements (IN adds, OUT subtracts, ADJUSTMENT adds).
`totalValue` = sum of `remainingQty * buyingPrice` across all active batches.

---

### GET /stocks/product/:productId

Detailed stock view for a single product: batches, total value, and movement history.

**Roles:** Any authenticated user

**Query params:**

| Param | Type   | Default | Description          |
|-------|--------|---------|----------------------|
| page  | number | 1       | Page number          |
| limit | number | 20      | Items per page       |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "product": {
      "_id": "...",
      "name": "Solar Panel 400W",
      "barcode": "A1E-000001"
    },
    "currentStock": 70,
    "totalValue": 3500,
    "batches": [
      {
        "_id": "batchId1",
        "product": "productId",
        "buyingPrice": 50,
        "initialQty": 100,
        "remainingQty": 70,
        "createdBy": "userId",
        "createdAt": "2026-07-15T..."
      }
    ],
    "movements": [
      {
        "_id": "...",
        "quantity": 30,
        "type": "OUT",
        "buyingPrice": null,
        "salePrice": 75,
        "reason": "Sale to Customer Y",
        "reference": "INV-001",
        "toOwner": null,
        "createdBatchId": null,
        "batchConsumutions": [
          {
            "batchId": "batchId1",
            "quantity": 30,
            "buyingPrice": 50
          }
        ],
        "createdBy": { "_id": "...", "name": "Admin User" },
        "createdAt": "2026-07-17T..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  },
  "message": "Product stock history fetched successfully"
}
```

`batches` = only active batches (remainingQty > 0), sorted oldest first.
`batchConsumutions` on each OUT movement shows exactly which batches were consumed.

---

### DELETE /stocks/:id

Delete a stock movement with batch restoration safety.

**Roles:** ADMIN, OWNER

**Safety rules:**
- IN / positive ADJUSTMENT: blocked if the associated batch has been partially consumed (remainingQty < initialQty). Returns 400 with errorType "BATCH_CONSUMED".
- OUT / TRANSFER / negative ADJUSTMENT: restores consumed quantities back to their batches.

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Stock movement deleted successfully"
}
```

**Error (400) — batch consumed:**
```json
{
  "success": false,
  "statusCode": 400,
  "errorType": "BATCH_CONSUMED",
  "message": "Cannot delete: stock from this batch has been consumed by other movements"
}
```

**Error (400) — insufficient stock:**
```json
{
  "success": false,
  "statusCode": 400,
  "errorType": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock. Available: 50, requested: 100"
}
```

---

## Future: Invoicing Integration

When a sale is confirmed via invoice, it automatically creates stock OUT
movements. This keeps stock in sync with sales and provides automatic
cost of goods sold (COGS) calculation from batch consumptions.

### Proposed Invoice Model

```typescript
interface Invoice {
  _id: ObjectId;
  invoiceNumber: string;           // auto-generated, e.g., INV-000001
  customer: ObjectId;              // reference to customer
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
  reference?: string;              // external reference
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface InvoiceItem {
  product: ObjectId;
  quantity: number;
  unitPrice: number;
  total: number;
  stockMovementId?: ObjectId;      // linked stock OUT (set on confirm)
  batchConsumutions?: BatchConsumution[];  // cost breakdown
  costOfGoodsSold?: number;        // sum of (qty * buyingPrice) from batches
}
```

### Proposed Endpoints

| Method | Path                  | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | /invoices/            | Create invoice (status: DRAFT)       |
| PATCH  | /invoices/:id         | Update invoice                       |
| POST   | /invoices/:id/confirm | Confirm → auto-create stock OUT      |
| GET    | /invoices/            | List invoices (paginated)            |
| GET    | /invoices/:id         | Get invoice detail                   |
| DELETE | /invoices/:id         | Delete invoice (only if DRAFT)       |

### Confirm Invoice Flow

```
POST /invoices/:id/confirm
  │
  ▼
Find invoice (must be DRAFT)
  │
  ▼
For each item in invoice.items:
  │
  ├── consumeBatchesFIFO(product, quantity)
  │     → BatchConsumution[]
  │
  ├── Create StockMovement
  │     type: "OUT"
  │     batchConsumutions: [...]
  │     reference: invoice.invoiceNumber
  │
  └── Update InvoiceItem:
        stockMovementId = movement._id
        batchConsumutions = [...]
        costOfGoodsSold = sum(qty * buyingPrice)
  │
  ▼
Set invoice.status = "CONFIRMED"
  │
  ▼
Return updated invoice with COGS per item
```

### Cancel Invoice Flow

```
POST /invoices/:id/cancel
  │
  ▼
Find invoice (must be CONFIRMED)
  │
  ▼
For each item with stockMovementId:
  │
  ├── Find stock movement
  │
  ├── Restore batches
  │     (reverse FIFO: increment remainingQty)
  │
  └── Delete stock movement
  │
  ▼
Set invoice.status = "CANCELLED"
  │
  ▼
Return updated invoice
```

---

## Error Codes

| ErrorType          | HTTP | When                                         |
|--------------------|------|----------------------------------------------|
| INSUFFICIENT_STOCK | 400  | OUT/TRANSFER/negative ADJUSTMENT exceeds available stock |
| BATCH_CONSUMED     | 400  | Trying to delete an IN whose batch was consumed |
| PRODUCT_HAS_STOCK  | 400  | Trying to delete a product with current stock > 0 |
| FORBIDDEN          | 403  | OWNER trying to delete another owner's product |
| INVALID_PASSWORD   | 400  | Current password is incorrect during password change |
| NOT_FOUND          | 404  | Product, movement, or user not found         |
| BAD_REQUEST        | 400  | Missing required fields or invalid type      |

---

## Frontend Integration Notes

### Stock Creation Form

| Type       | Fields Required                                         |
|------------|---------------------------------------------------------|
| IN         | product, quantity, buyingPrice, reason                  |
| OUT        | product, quantity, salePrice, reason                     |
| ADJUSTMENT | product, quantity, reason, buyingPrice (if positive)    |
| TRANSFER   | product, quantity, toOwner (user selector), reason      |

### Stock Summary Page

- Table: product name, barcode, current stock, total value (inventory valuation)
- Low stock filter toggle (shows products with stock <= 0)
- Click row → navigate to product stock detail

### Product Stock Detail Page

- Header: product name, barcode, current stock, total value
- Batches section: table of active batches with buyingPrice, remainingQty
- Movements section: paginated list of all movements for this product
- Each movement shows: type badge, quantity, prices, batch consumptions, reason, who, date

### Stock Movements Page

- Filterable list of all movements
- Type filter (IN / OUT / ADJUSTMENT / TRANSFER)
- Product search
- Owner filter (admin only)
- Each movement: product name, type badge, quantity, prices, reason, date

### Inventory Value Display

- Use `totalValue` from summary and product detail responses
- Shows total cost of remaining inventory across all batches
- Useful for financial reporting and reorder decisions

### Product Deletion Safety

- Products with `currentStock > 0` cannot be deleted (returns 400 PRODUCT_HAS_STOCK)
- OWNER role can only delete their own products (returns 403 FORBIDDEN)
- ADMIN can delete any product regardless of stock or owner
- Frontend should show stock level before allowing delete action

### Low Stock Filter

- `?lowStock=true` → products with stock <= 0 (backward compatible)
- `?lowStock=10` → products with stock <= 10 (configurable threshold)
- Frontend can use this for reorder alerts and inventory monitoring

### Change Password

- `PATCH /api/v1/auth/password` requires `currentPassword` and `newPassword`
- `newPassword` must be 8-128 characters
- Returns 400 INVALID_PASSWORD if current password is wrong
- Frontend should show success message and optionally log user out
