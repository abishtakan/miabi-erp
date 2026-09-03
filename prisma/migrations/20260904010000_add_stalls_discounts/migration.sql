-- This is an additive, rollback-safe migration. The previous application can
-- continue writing orders: defaults and the compatibility trigger preserve its
-- original total as the new subtotal. Do not remove the added columns in a
-- rollback; deploy the previous application and contract in a later migration.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('STALL_FEE', 'FOOD', 'TRANSPORT', 'OTHER');

-- AlterTable: nullable first, backfill existing rows, then enforce the new shape.
ALTER TABLE "orders"
    ADD COLUMN "subtotal_amount" DECIMAL(12,2),
    ADD COLUMN "discount_type" "DiscountType" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "popup_stall_id" UUID;

UPDATE "orders" SET "subtotal_amount" = "total_amount" WHERE "subtotal_amount" IS NULL;

ALTER TABLE "orders"
    ALTER COLUMN "subtotal_amount" SET NOT NULL,
    ALTER COLUMN "subtotal_amount" SET DEFAULT 0,
    ADD CONSTRAINT "orders_subtotal_nonnegative" CHECK ("subtotal_amount" >= 0),
    ADD CONSTRAINT "orders_discount_value_nonnegative" CHECK ("discount_value" >= 0),
    ADD CONSTRAINT "orders_discount_amount_valid" CHECK ("discount_amount" >= 0 AND "discount_amount" <= "subtotal_amount"),
    ADD CONSTRAINT "orders_total_matches_discount" CHECK ("total_amount" = "subtotal_amount" - "discount_amount");

-- Preserve net line revenue so brand totals reconcile after an order discount.
ALTER TABLE "order_items"
    ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "net_line_total" DECIMAL(12,2);

UPDATE "order_items" SET "net_line_total" = "line_total" WHERE "net_line_total" IS NULL;

ALTER TABLE "order_items"
    ALTER COLUMN "net_line_total" SET NOT NULL,
    ALTER COLUMN "net_line_total" SET DEFAULT 0,
    ADD CONSTRAINT "order_items_discount_amount_valid" CHECK ("discount_amount" >= 0 AND "discount_amount" <= "line_total"),
    ADD CONSTRAINT "order_items_net_total_matches_discount" CHECK ("net_line_total" = "line_total" - "discount_amount");

-- Mixed-version compatibility: an older application only supplies total_amount.
CREATE FUNCTION "set_legacy_order_subtotal"() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."subtotal_amount" = 0 AND NEW."total_amount" > 0 AND NEW."discount_amount" = 0 THEN
        NEW."subtotal_amount" := NEW."total_amount";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "orders_legacy_subtotal_trigger"
BEFORE INSERT ON "orders"
FOR EACH ROW EXECUTE FUNCTION "set_legacy_order_subtotal"();

CREATE FUNCTION "set_legacy_order_item_net_total"() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."net_line_total" = 0 AND NEW."line_total" > 0 AND NEW."discount_amount" = 0 THEN
        NEW."net_line_total" := NEW."line_total";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "order_items_legacy_net_total_trigger"
BEFORE INSERT ON "order_items"
FOR EACH ROW EXECUTE FUNCTION "set_legacy_order_item_net_total"();

-- CreateTable
CREATE TABLE "popup_stalls" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(120),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popup_stalls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "popup_stalls_date_order" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "popup_stall_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" VARCHAR(240),
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expenses_amount_positive" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "orders_popup_stall_id_created_at_idx" ON "orders"("popup_stall_id", "created_at" DESC);
CREATE INDEX "popup_stalls_is_active_starts_at_idx" ON "popup_stalls"("is_active", "starts_at" DESC);
CREATE INDEX "expenses_popup_stall_id_incurred_at_idx" ON "expenses"("popup_stall_id", "incurred_at" DESC);
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_popup_stall_id_fkey" FOREIGN KEY ("popup_stall_id") REFERENCES "popup_stalls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_popup_stall_id_fkey" FOREIGN KEY ("popup_stall_id") REFERENCES "popup_stalls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
