# MIABI Boutique Manager

An internal, mobile-first inventory and point-of-sale application for MIABI's Lolark and Mundhanai brands. It records selling prices and product costs in LKR, supports order discounts, protects checkout with database stock validation, and reports recorded profit across pop-up stalls.

The complete product scope and business rules are in [`prd.md`](./prd.md). Visual direction is in [`DESIGN.md`](./DESIGN.md).

## Requirements

- Node.js 20 or newer
- PostgreSQL (Railway is the production target)
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` to a PostgreSQL database.
   - `APP_PASSWORD` to the shared team password.
   - `AUTH_SECRET` to a random value of at least 32 characters.

3. Apply the checked-in migration and generate the client:

   ```bash
   npm run db:deploy
   npm run db:generate
   ```

4. Optionally add the 10 demo products (five per brand):

   ```bash
   npm run db:seed
   ```

5. Start the application:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) and sign in with `APP_PASSWORD`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without output |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply checked-in migrations in production |
| `npm run db:seed` | Idempotently add demo catalog products |
| `npm run db:studio` | Open Prisma Studio |

## Railway and Vercel deployment

1. Create a Railway PostgreSQL service and copy its public connection URL.
2. In Vercel, add `DATABASE_URL`, `APP_PASSWORD`, and `AUTH_SECRET` to the Production environment.
3. Keep Vercel's build command as `npm run build`. `postinstall` generates Prisma Client.
4. Apply database migrations before sending traffic to a new schema:

   ```bash
   npm run db:deploy
   ```

   This can run locally against the Railway URL or in a dedicated CI/deployment step.

5. Deploy the Next.js project to Vercel. Production HTTPS makes the session cookie secure-only.

Do not run `prisma db push` against production. Use committed migrations so schema changes remain repeatable and reviewable.

## Data integrity notes

- Product, order, line-item, and movement values are validated again in Server Actions.
- Checkout reloads selling prices and product costs from PostgreSQL and never accepts client-calculated totals.
- Percentage and fixed-LKR discounts are recalculated on the server and allocated across order lines so brand totals reconcile.
- Every new pop-up sale is attributed to an active stall; older unattributed orders remain compatible.
- Conditional stock updates and a serializable transaction prevent overselling.
- Orders, line items, stock decrements, and sale movements commit or roll back together.
- Products are archived instead of deleted, and order items retain name, brand, selling-price, and product-cost snapshots.
- Dashboard recorded net profit is revenue after discounts minus snapshotted product costs and tracked stall expenses.
- Stall net contribution is revenue after discounts minus snapshotted product costs and that event's tracked expenses; it is not full profit accounting.
- Existing products and sales receive a zero cost when the product-cost migration is first applied because their historical purchase cost cannot be reconstructed. Enter current costs in Inventory; old sales remain zero-cost historical records.

## MVP security boundary

The application uses a signed, HTTP-only shared-password session. It is appropriate for the small trusted team described in the PRD, but it does not provide individual identities, roles, password recovery, or per-user auditing. Move to managed user accounts before broadening access beyond that team.
