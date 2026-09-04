"use server";

import {
  Brand,
  DiscountType,
  ExpenseCategory,
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
  costPrice: string;
  openingStock?: string;
};

export type CheckoutInput = {
  salesChannel: string;
  popupStallId?: string | null;
  discountType: string;
  discountValue: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type PopupStallInput = {
  name: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
};

export type ExpenseInput = {
  popupStallId: string;
  category: string;
  amount: string;
  incurredAt: string;
  note?: string;
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

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError(`${label} is invalid.`);
  const clean = value.trim();
  if (!clean) return null;
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

function parseDiscountType(value: unknown) {
  if (
    value !== DiscountType.NONE &&
    value !== DiscountType.PERCENTAGE &&
    value !== DiscountType.FIXED_AMOUNT
  ) {
    throw new InputError("Choose a valid discount type.");
  }
  return value;
}

function parseExpenseCategory(value: unknown) {
  if (
    value !== ExpenseCategory.STALL_FEE &&
    value !== ExpenseCategory.FOOD &&
    value !== ExpenseCategory.TRANSPORT &&
    value !== ExpenseCategory.OTHER
  ) {
    throw new InputError("Choose a valid expense category.");
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

function parseNonnegativeAmount(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) {
    throw new InputError(`${label} must be a valid number with up to 2 decimals.`);
  }
  return new Prisma.Decimal(value.trim());
}

function parseDate(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new InputError(`${label} is required.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new InputError(`${label} is invalid.`);
  return date;
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
    costPrice: parseNonnegativeAmount(input.costPrice, "Product cost"),
    openingStock: includeStock
      ? parseInteger(input.openingStock ?? "0", "Opening stock", 0)
      : 0,
  };
}

function parsePopupStall(input: PopupStallInput) {
  const startsAt = parseDate(input.startsAt, "Start date");
  const endsAt = input.endsAt ? parseDate(input.endsAt, "End date") : null;
  if (endsAt && endsAt < startsAt) {
    throw new InputError("End date cannot be before the start date.");
  }

  return {
    name: requiredText(input.name, "Stall name", 100),
    location: optionalText(input.location, "Location", 120),
    startsAt,
    endsAt,
  };
}

function allocateDiscount<Line extends { lineTotal: Prisma.Decimal }>(
  lines: Line[],
  subtotalAmount: Prisma.Decimal,
  discountAmount: Prisma.Decimal,
) {
  if (discountAmount.isZero()) {
    return lines.map((line) => ({
      ...line,
      lineDiscountAmount: new Prisma.Decimal(0),
      netLineTotal: line.lineTotal,
    }));
  }

  const discountCents = discountAmount.mul(100).toDecimalPlaces(0).toNumber();
  const allocations = lines.map((line, index) => {
    const exactCents = line.lineTotal
      .div(subtotalAmount)
      .mul(discountCents);
    const cents = exactCents.floor().toNumber();
    return {
      index,
      cents,
      remainder: exactCents.minus(cents),
    };
  });
  let centsLeft =
    discountCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const byRemainder = [...allocations].sort((left, right) =>
    right.remainder.comparedTo(left.remainder),
  );
  for (const allocation of byRemainder) {
    if (centsLeft <= 0) break;
    allocation.cents += 1;
    centsLeft -= 1;
  }
  const centsByIndex = new Map(
    allocations.map((allocation) => [allocation.index, allocation.cents]),
  );

  return lines.map((line, index) => {
    const lineDiscountAmount = new Prisma.Decimal(centsByIndex.get(index) ?? 0).div(100);
    return {
      ...line,
      lineDiscountAmount,
      netLineTotal: line.lineTotal.minus(lineDiscountAmount),
    };
  });
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
  revalidatePath("/stalls");
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
        costPrice: product.costPrice,
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
        costPrice: product.costPrice,
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

export async function createPopupStall(
  input: PopupStallInput,
): Promise<ActionResult<{ id: string }>> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const stall = parsePopupStall(input);
    const created = await prisma.popupStall.create({
      data: stall,
      select: { id: true },
    });
    refreshInventoryViews();
    return { ok: true, message: "Pop-up stall added.", data: created };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function updatePopupStall(
  popupStallId: string,
  input: PopupStallInput,
): Promise<ActionResult> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const id = requiredText(popupStallId, "Pop-up stall", 64);
    const stall = parsePopupStall(input);
    await prisma.popupStall.update({ where: { id }, data: stall });
    refreshInventoryViews();
    return { ok: true, message: "Pop-up stall updated.", data: null };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function setPopupStallActive(
  popupStallId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const id = requiredText(popupStallId, "Pop-up stall", 64);
    if (typeof isActive !== "boolean") throw new InputError("Invalid status.");
    await prisma.popupStall.update({ where: { id }, data: { isActive } });
    refreshInventoryViews();
    return {
      ok: true,
      message: isActive ? "Pop-up stall restored." : "Pop-up stall archived.",
      data: null,
    };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function addStallExpense(
  input: ExpenseInput,
): Promise<ActionResult<{ id: string }>> {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const popupStallId = requiredText(input.popupStallId, "Pop-up stall", 64);
    const category = parseExpenseCategory(input.category);
    const amount = parsePrice(input.amount);
    const incurredAt = parseDate(input.incurredAt, "Expense date");
    const note = optionalText(input.note, "Note", 240);

    const created = await prisma.expense.create({
      data: { popupStallId, category, amount, incurredAt, note },
      select: { id: true },
    });
    revalidatePath("/stalls");
    return { ok: true, message: "Expense recorded.", data: created };
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
    const popupStallId =
      salesChannel === SalesChannel.POP_UP_STALL
        ? requiredText(input?.popupStallId, "Pop-up stall", 64)
        : null;
    const requestedDiscountType = parseDiscountType(input?.discountType);
    const requestedDiscountValue = parseNonnegativeAmount(
      input?.discountValue,
      "Discount",
    );
    const discountType =
      requestedDiscountType === DiscountType.NONE ||
      requestedDiscountValue.isZero()
      ? DiscountType.NONE
      : requestedDiscountType;
    const discountValue =
      discountType === DiscountType.NONE
        ? new Prisma.Decimal(0)
        : requestedDiscountValue;

    if (
      discountType === DiscountType.PERCENTAGE &&
      discountValue.gt(100)
    ) {
      throw new InputError("Percentage discount cannot be greater than 100%.");
    }
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
            if (popupStallId) {
              const stallExists = await transaction.popupStall.count({
                where: { id: popupStallId, isActive: true },
              });
              if (stallExists !== 1) {
                throw new InputError(
                  "Choose an active pop-up stall before checkout.",
                );
              }
            }

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
                lineCostTotal: product.costPrice.mul(item.quantity),
              };
            });

            const subtotalAmount = lines.reduce(
              (total, line) => total.add(line.lineTotal),
              new Prisma.Decimal(0),
            );
            const discountAmount =
              discountType === DiscountType.PERCENTAGE
                ? subtotalAmount
                    .mul(discountValue)
                    .div(100)
                    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
                : discountType === DiscountType.FIXED_AMOUNT
                  ? discountValue
                  : new Prisma.Decimal(0);

            if (discountAmount.gt(subtotalAmount)) {
              throw new InputError("Fixed discount cannot exceed the subtotal.");
            }
            const totalAmount = subtotalAmount.minus(discountAmount);
            const costAmount = lines.reduce(
              (total, line) => total.add(line.lineCostTotal),
              new Prisma.Decimal(0),
            );
            const discountedLines = allocateDiscount(
              lines,
              subtotalAmount,
              discountAmount,
            );

            const order = await transaction.order.create({
              data: {
                salesChannel,
                popupStallId,
                subtotalAmount,
                discountType,
                discountValue,
                discountAmount,
                costAmount,
                totalAmount,
                items: {
                  create: discountedLines.map((line) => ({
                    productId: line.product.id,
                    productName: line.product.name,
                    brandAtCheckout: line.product.brand,
                    quantity: line.quantity,
                    priceAtCheckout: line.product.price,
                    lineTotal: line.lineTotal,
                    discountAmount: line.lineDiscountAmount,
                    netLineTotal: line.netLineTotal,
                    costAtCheckout: line.product.costPrice,
                    lineCostTotal: line.lineCostTotal,
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
