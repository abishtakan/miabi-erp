-- CreateEnum
CREATE TYPE "Brand" AS ENUM ('LOLARK', 'MUNDHANAI');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'POP_UP_STALL');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'SALE', 'RESTOCK', 'CORRECTION');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "brand" "Brand" NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_positive" CHECK ("price" > 0),
    CONSTRAINT "products_stock_nonnegative" CHECK ("stock_quantity" >= 0)
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "sales_channel" "SalesChannel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_total_nonnegative" CHECK ("total_amount" >= 0)
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(120) NOT NULL,
    "brand_at_checkout" "Brand" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_at_checkout" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "order_items_price_nonnegative" CHECK ("price_at_checkout" >= 0),
    CONSTRAINT "order_items_line_total_nonnegative" CHECK ("line_total" >= 0)
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "note" VARCHAR(240),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_change_nonzero" CHECK ("quantity_change" <> 0),
    CONSTRAINT "stock_movements_balance_nonnegative" CHECK ("balance_after" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_brand_is_active_idx" ON "products"("brand", "is_active");
CREATE INDEX "products_category_idx" ON "products"("category");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);
CREATE INDEX "orders_sales_channel_created_at_idx" ON "orders"("sales_channel", "created_at" DESC);
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");
CREATE INDEX "order_items_brand_at_checkout_idx" ON "order_items"("brand_at_checkout");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at" DESC);
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
