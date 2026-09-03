"use server";

import {
  Brand,
  Prisma,
  SalesChannel,
  StockMovementType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionFailure = { ok: false; message: string };

export type ActionResult<T = null> =
  | { ok: true; message: string; data: T }
  | ActionFailure;

export type ProductInput = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  openingStock?: string;
};

export type CheckoutInput = {
  salesChannel: string;
  items: Array<{ productId: string; quantity: number }>;
};

class InputError extends Error {}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new InputError(`${label} is required.`);
  const clean = value.trim();
  if (!clean) throw new InputError(`${label} is required.`);
  if (clean.length > maxLength) {
    throw new InputError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

function parseBrand(value: unknown) {
  if (value !== Brand.LOLARK && value !== Brand.MUNDHANAI) {
    throw new InputError("Choose a valid brand.");
  }
  return value;
}

function parseSalesChannel(value: unknown) {
  if (
    value !== SalesChannel.ONLINE &&
    value !== SalesChannel.POP_UP_STALL
  ) {
    throw new InputError("Choose Online or Pop-up stall before checkout.");
  }
  return value;
}

function parsePrice(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) {
    throw new InputError("Price must be a valid LKR amount with up to 2 decimals.");
  }

  const price = new Prisma.Decimal(value.trim());
  if (price.lte(0)) throw new InputError("Price must be greater than zero.");
  return price;
}

function parseInteger(value: unknown, label: string, minimum: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new InputError(`${label} must be an integer of ${minimum} or more.`);
  }
  return number;
}

function parseProduct(input: ProductInput, includeStock: boolean) {
  const sku = requiredText(input.sku, "SKU", 32).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(sku)) {
    throw new InputError("SKU can only use letters, numbers, hyphens, and underscores.");
  }

  return {
    sku,
    name: requiredText(input.name, "Name", 120),
    brand: parseBrand(input.brand),
    category: requiredText(input.category, "Category", 80),
    price: parsePrice(input.price),
    openingStock: includeStock
      ? parseInteger(input.openingStock ?? "0", "Opening stock", 0)
      : 0,
  };
}

function safeFailure(error: unknown): ActionFailure {
  if (error instanceof InputError) return { ok: false, message: error.message };

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return { ok: false, message: "That SKU is already in use." };
  }

  console.error(error);
  return {
    ok: false,
    message: "Something went wrong. Nothing was changed; please try again.",
  };
}

async function authorize(): Promise<ActionFailure | null> {
  if (await isAuthenticated()) return null;
  return {
    ok: false,
    message: "Your session has expired. Refresh the page and sign in again.",
  };
}

function refreshInventoryViews() {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function createProduct(
  input: ProductInput,
): Promise<ActionResult<{ id: string }>> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const product = parseProduct(input, true);
    const created = await prisma.product.create({
      data: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        stockQuantity: product.openingStock,
        stockMovements:
          product.openingStock > 0
            ? {
                create: {
                  type: StockMovementType.OPENING,
                  quantityChange: product.openingStock,
                  balanceAfter: product.openingStock,
                  note: "Opening stock",
                },
              }
            : undefined,
      },
      select: { id: true },
    });

    refreshInventoryViews();
    return { ok: true, message: "Product added.", data: created };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
): Promise<ActionResult> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const id = requiredText(productId, "Product", 64);
    const product = parseProduct(input, false);
    await prisma.product.update({
      where: { id },
      data: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
      },
    });

    refreshInventoryViews();
    return { ok: true, message: "Product updated.", data: null };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function setProductActive(
  productId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const id = requiredText(productId, "Product", 64);
    if (typeof isActive !== "boolean") throw new InputError("Invalid status.");

    await prisma.product.update({ where: { id }, data: { isActive } });
    refreshInventoryViews();
    return {
      ok: true,
      message: isActive ? "Product restored." : "Product archived.",
      data: null,
    };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function adjustStock(
  productId: string,
  quantityChange: number,
  note: string,
): Promise<ActionResult> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const id = requiredText(productId, "Product", 64);
    const change = parseInteger(Math.abs(quantityChange), "Quantity", 1) *
      (quantityChange < 0 ? -1 : 1);
    const cleanNote = requiredText(note, "Reason", 240);

    await prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.product.updateMany({
          where: {
            id,
            ...(change < 0
              ? { stockQuantity: { gte: Math.abs(change) } }
              : {}),
          },
          data: { stockQuantity: { increment: change } },
        });

        if (updated.count !== 1) {
          const productExists = await transaction.product.count({ where: { id } });
          if (!productExists) throw new InputError("Product no longer exists.");
          throw new InputError("This reduction is greater than the available stock.");
        }

        const product = await transaction.product.findUniqueOrThrow({
          where: { id },
          select: { stockQuantity: true },
        });

        await transaction.stockMovement.create({
          data: {
            productId: id,
            type:
              change > 0
                ? StockMovementType.RESTOCK
                : StockMovementType.CORRECTION,
            quantityChange: change,
            balanceAfter: product.stockQuantity,
            note: cleanNote,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    refreshInventoryViews();
    return { ok: true, message: "Stock updated.", data: null };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function checkout(
  input: CheckoutInput,
): Promise<ActionResult<{ orderId: string }>> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const salesChannel = parseSalesChannel(input?.salesChannel);
    if (!Array.isArray(input?.items) || input.items.length === 0) {
      throw new InputError("Add at least one product to the cart.");
    }
    if (input.items.length > 50) {
      throw new InputError("A sale can contain at most 50 different products.");
    }

    const quantities = new Map<string, number>();
    for (const rawItem of input.items) {
      const productId = requiredText(rawItem?.productId, "Product", 64);
      const quantity = parseInteger(rawItem?.quantity, "Quantity", 1);
      if (quantity > 999) throw new InputError("Quantity cannot exceed 999.");
      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    }

    const items = Array.from(quantities, ([productId, quantity]) => ({
      productId,
      quantity,
    }));
    if (items.some((item) => item.quantity > 999)) {
      throw new InputError("Quantity cannot exceed 999.");
    }

    let orderId = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        orderId = await prisma.$transaction(
          async (transaction) => {
            const products = await transaction.product.findMany({
              where: { id: { in: items.map((item) => item.productId) } },
            });

            if (products.length !== items.length) {
              throw new InputError("One or more products are no longer available.");
            }

            const productById = new Map(
              products.map((product) => [product.id, product]),
            );
            const lines = items.map((item) => {
              const product = productById.get(item.productId);
              if (!product || !product.isActive) {
                throw new InputError("One or more products are no longer available.");
              }
              if (product.stockQuantity < item.quantity) {
                throw new InputError(
                  `${product.name} only has ${product.stockQuantity} in stock.`,
                );
              }

              return {
                product,
                quantity: item.quantity,
                lineTotal: product.price.mul(item.quantity),
              };
            });

            const totalAmount = lines.reduce(
              (total, line) => total.add(line.lineTotal),
              new Prisma.Decimal(0),
            );

            const order = await transaction.order.create({
              data: {
                salesChannel,
                totalAmount,
                items: {
                  create: lines.map((line) => ({
                    productId: line.product.id,
                    productName: line.product.name,
                    brandAtCheckout: line.product.brand,
                    quantity: line.quantity,
                    priceAtCheckout: line.product.price,
                    lineTotal: line.lineTotal,
                  })),
                },
              },
              select: { id: true },
            });

            for (const line of lines) {
              const changed = await transaction.product.updateMany({
                where: {
                  id: line.product.id,
                  isActive: true,
                  stockQuantity: { gte: line.quantity },
                },
                data: { stockQuantity: { decrement: line.quantity } },
              });

              if (changed.count !== 1) {
                throw new InputError(
                  `${line.product.name} sold out while this sale was being completed.`,
                );
              }

              await transaction.stockMovement.create({
                data: {
                  productId: line.product.id,
                  orderId: order.id,
                  type: StockMovementType.SALE,
                  quantityChange: -line.quantity,
                  balanceAfter: line.product.stockQuantity - line.quantity,
                  note: "POS sale",
                },
              });
            }

            return order.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!orderId) throw new Error("Checkout did not complete.");
    refreshInventoryViews();
    return { ok: true, message: "Sale completed.", data: { orderId } };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
