# Product Requirements Document: MIABI Boutique Manager

**Status:** MVP implementation specification  
**Currency:** Sri Lankan Rupee (LKR)  
**Brands:** Lolark and Mundhanai  
**Primary environment:** Mobile and tablet use at pop-up stalls, with desktop support

## 1. Product summary

MIABI Boutique Manager is a lightweight internal application for maintaining a flat product catalog, recording stock changes, completing sales, and reviewing basic business performance for MIABI's two brands.

The product is intentionally smaller than a general ERP. It optimizes the path from choosing a product to recording a valid sale, while keeping enough history for revenue and stock figures to remain trustworthy.

## 2. Problem statement

MIABI needs one source of truth for:

- What is currently available to sell.
- What was sold, at what price, and through which channel.
- How Lolark and Mundhanai are performing.
- Why stock changed outside a sale.

Pop-up stall sales are time-sensitive. The POS must be usable with one hand on a phone or tablet, must reject overselling even when two devices check out at once, and must not require product-variant training.

## 3. Goals and success criteria

### Goals

1. Let an authorized team member add, update, archive, and restock products.
2. Complete a sale from an in-stock catalog with minimal taps.
3. Preserve the product name, brand, and price that applied at checkout.
4. Keep orders, stock deductions, and stock history consistent in one database transaction.
5. Show useful LKR revenue, order, brand, channel, and recent-order summaries.

### MVP success criteria

- A first-time team member can record a sale without training.
- A checkout never produces negative stock.
- Concurrent checkouts for the last unit result in exactly one successful order.
- Archived products disappear from the POS but remain in historical orders.
- Dashboard totals match stored completed orders and their line items.
- All money is stored as fixed-precision decimal values and displayed as LKR.

## 4. Users and access

### User

The founder and trusted team members assisting with inventory, online orders, and pop-up stalls.

### MVP access model

- The application is private and protected by one shared team password.
- A successful sign-in creates a signed, HTTP-only session cookie.
- Every mutation checks the session on the server; hiding a screen is not treated as authorization.
- The team password and signing secret are environment variables and are never stored in the database.

Individual accounts, roles, password recovery, and per-user audit attribution are post-MVP.

## 5. Product scope

### 5.1 Inventory management

Products are flat catalog entries. For example, a red saree and a blue saree are two products, not variants.

Each product has:

- Unique SKU, normalized to uppercase.
- Name.
- Brand: `LOLARK` or `MUNDHANAI`.
- Free-text category.
- Selling price in LKR, with at most two decimal places.
- Non-negative stock quantity.
- Active or archived status.
- Created and last-updated timestamps.

Users can:

- Search by SKU, name, or category.
- Filter by brand and active/archived status.
- Add a product with optional opening stock.
- Edit SKU, name, brand, category, and selling price.
- Increase stock for restocks or decrease stock for corrections.
- Add a required reason for every manual stock adjustment.
- Archive or restore a product.

Products are archived instead of hard-deleted. This preserves order and stock history.

### 5.2 Point of sale

The POS shows only active products with stock above zero.

Users can:

- Search products and filter by brand.
- Tap a product to add one unit to the cart.
- Increase, decrease, or remove cart quantities.
- See each line total and the LKR order total.
- Select exactly one required channel: `ONLINE` or `POP_UP_STALL`.
- Submit the checkout once.

Checkout rules:

- The cart must contain at least one and no more than 50 distinct products.
- Quantities must be positive integers and cannot exceed 999 per line.
- The server reloads products and prices from the database; client totals are never trusted.
- Inactive, missing, or insufficient-stock products reject the entire checkout.
- Stock is decremented with a conditional database update so concurrent sales cannot oversell.
- Order, order items, stock deductions, and sale stock movements are committed in one Prisma transaction.
- A failed transaction creates no partial order and makes no stock change.
- A successful checkout clears the cart and shows a short order reference.

### 5.3 Dashboard

The dashboard shows:

- Total revenue in LKR.
- Total order count.
- Lolark revenue.
- Mundhanai revenue.
- Online revenue and order count.
- Pop-up stall revenue and order count.
- The 10 most recent orders with time, channel, item quantity, and total.

Revenue is based on checkout snapshots in `OrderItem`, so later product edits do not change historical brand or price reporting.

### 5.4 Stock history

Every stock change creates a movement containing:

- Product.
- Optional related order.
- Type: opening stock, sale, restock, or correction.
- Signed quantity change.
- Balance immediately after the change.
- Optional note and timestamp.

The MVP records this history for data integrity; a dedicated stock-history report is post-MVP.

## 6. User flows

### Add inventory

1. Open Inventory and choose Add product.
2. Enter SKU, name, brand, category, price, and opening stock.
3. Submit.
4. The server validates the values, creates the product, and records opening stock when it is above zero.
5. The inventory and POS views refresh.

### Adjust stock

1. Choose Adjust stock on a product.
2. Enter a positive restock quantity or negative correction and a reason.
3. Submit.
4. The server rejects a change that would make stock negative.
5. The product balance and stock movement are saved atomically.

### Complete a sale

1. Open POS and tap available products.
2. Correct quantities in the cart.
3. Select Online or Pop-up stall.
4. Review the LKR total and choose Complete sale.
5. The server validates current products, prices, and stock and runs the checkout transaction.
6. On success, show the order reference and refresh availability. On failure, keep the cart and show an actionable message.

## 7. Data model

### Product

Current sellable catalog state. Price uses `Decimal(12,2)`; stock has a database non-negative constraint.

### Order

Immutable sale header containing server-calculated total, sales channel, and creation time.

### OrderItem

Immutable sale line containing product reference plus name, brand, unit-price, quantity, and line-total snapshots. Only one line per product is allowed in an order.

### StockMovement

Append-only inventory ledger linked to a product and, for sale movements, the related order.

### Enumerations

- `Brand`: `LOLARK`, `MUNDHANAI`
- `SalesChannel`: `ONLINE`, `POP_UP_STALL`
- `StockMovementType`: `OPENING`, `SALE`, `RESTOCK`, `CORRECTION`

The Prisma schema and checked-in SQL migration are the executable source of truth.

## 8. UX and visual requirements

- Strict dark, monochrome interface following `DESIGN.md`.
- Mobile-first layout with at least 44px touch targets.
- Fixed mobile navigation for Dashboard, POS, and Inventory.
- Sharp corners, no gradients, and no decorative shadows.
- Semantic labels, keyboard-visible focus states, live action feedback, and sufficient contrast.
- POS total and checkout controls remain easy to reach while scrolling.
- Empty states explain the next useful action.
- Destructive-looking actions are reserved for archiving and stock reductions.

## 9. Validation and error handling

- Validate all action inputs on the server.
- Product text fields are trimmed and length-limited.
- SKU must contain only letters, numbers, hyphens, or underscores.
- Price must be greater than zero and have no more than two decimal places.
- Stock and quantities must be integers.
- Duplicate SKUs return a user-readable error.
- Database and unexpected errors return a safe generic message and are logged server-side.
- Pages explain missing database configuration instead of rendering a broken interface.

## 10. Technical requirements

- Next.js App Router with React Server Components and Server Actions.
- Tailwind CSS, with small local UI primitives to keep the MVP dependency-light.
- PostgreSQL hosted on Railway.
- Prisma ORM and checked-in migrations.
- Vercel deployment for the application.
- Prisma singleton in development to avoid hot-reload connection exhaustion.
- Dynamic database-backed routes; no stale catalog or dashboard cache.
- Seed command that creates five products for each brand and is safe to run repeatedly.

### Required environment variables

- `DATABASE_URL`: Railway PostgreSQL connection URL.
- `APP_PASSWORD`: Shared internal sign-in password.
- `AUTH_SECRET`: Random value of at least 32 characters used to sign sessions.

## 11. Acceptance criteria

### Access

- Unauthenticated users cannot open Dashboard, POS, or Inventory.
- An incorrect password shows an error and does not create a session.
- Sign out clears the session.

### Inventory

- Creating valid products updates Inventory and POS.
- Duplicate SKU, invalid price, and negative opening stock are rejected.
- Editing a product does not alter historical order snapshots.
- A manual reduction below zero is rejected without creating a movement.
- Archived products are visible in Inventory and absent from POS.

### POS

- The checkout button is unavailable without a cart and selected channel.
- The displayed total equals the sum of cart lines in LKR.
- The server uses database prices even if a request supplies altered client data.
- A valid checkout creates one order, its items, sale movements, and exact stock decrements.
- An invalid line rolls back the whole checkout.
- Concurrent attempts to sell unavailable stock cannot both succeed.

### Dashboard

- Total revenue and order count cover all stored orders.
- Brand totals use `brandAtCheckout` and line totals.
- Channel totals use the order channel.
- Recent orders are sorted newest first and limited to 10.

## 12. Non-goals for MVP

- Product variants, barcode scanning, product photos, suppliers, or purchase orders.
- Customer profiles, shipping, returns, refunds, discounts, taxes, or payment processing.
- Expenses, profit, cost of goods, cash reconciliation, or accounting exports.
- Multi-currency support; all values are LKR.
- Individual user accounts, roles, or per-user audit history.
- Offline checkout or conflict synchronization.
- Order editing or deletion.
- Dedicated stock-ledger and custom date-range reports.

## 13. Delivery milestones

1. Schema, initial migration, generated Prisma client, and repeatable seed data.
2. Shared-password access and responsive application shell.
3. Inventory catalog, editing, stock adjustment, and archiving.
4. Transactional POS checkout with concurrency-safe stock validation.
5. LKR dashboard and recent transactions.
6. Prisma validation, lint, type-check, production build, and deployment documentation.

## 14. Deployment and operating assumptions

- Railway and Vercel environment variables are configured before first use.
- Run migrations during deployment with `npm run db:deploy`; do not use `db push` in production.
- Run `npm run db:seed` only when demo inventory is wanted.
- HTTPS is required in production so the session cookie is secure.
- PostgreSQL backups and Railway availability are operational responsibilities outside the application.

