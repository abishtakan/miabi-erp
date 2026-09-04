-- Additive and rollback-safe: old application versions ignore these columns
-- and continue writing successfully because every new column has a zero default.
-- Existing sales have no recoverable historical cost, so they remain at zero.

-- AlterTable
ALTER TABLE "products"
    ADD COLUMN "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT "products_cost_price_nonnegative" CHECK ("cost_price" >= 0);

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN "cost_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT "orders_cost_amount_nonnegative" CHECK ("cost_amount" >= 0);

-- AlterTable
ALTER TABLE "order_items"
    ADD COLUMN "cost_at_checkout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "line_cost_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT "order_items_cost_at_checkout_nonnegative" CHECK ("cost_at_checkout" >= 0),
    ADD CONSTRAINT "order_items_line_cost_total_valid" CHECK ("line_cost_total" = "cost_at_checkout" * "quantity");
