"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkout } from "@/app/actions";
import { Badge, EmptyState } from "@/components/ui";
import { brandLabel, formatColomboDate, formatLkr } from "@/lib/format";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  brand: "LOLARK" | "MUNDHANAI";
  category: string;
  price: string;
  stockQuantity: number;
};

type PopupStall = {
  id: string;
  name: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
};

type Channel = "ONLINE" | "POP_UP_STALL";
type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

const controlClass =
  "min-h-11 w-full border border-zinc-700 bg-black px-3 text-sm text-white placeholder:text-zinc-700 focus:border-white focus:outline-none";

function defaultStallId(stalls: PopupStall[]) {
  const now = Date.now();
  const current = stalls.find((stall) => {
    const startsAt = new Date(stall.startsAt).getTime();
    const endsAt = stall.endsAt ? new Date(stall.endsAt).getTime() : Number.POSITIVE_INFINITY;
    return startsAt <= now && endsAt >= now;
  });
  if (current) return current.id;

  const upcoming = stalls
    .filter((stall) => new Date(stall.startsAt).getTime() > now)
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0];
  return upcoming?.id ?? stalls[0]?.id ?? "";
}

export function PosClient({
  products,
  popupStalls,
}: {
  products: PosProduct[];
  popupStalls: PopupStall[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [channel, setChannel] = useState<Channel>("POP_UP_STALL");
  const [popupStallId, setPopupStallId] = useState(() => defaultStallId(popupStalls));
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesBrand = brand === "ALL" || product.brand === brand;
      const matchesQuery =
        !cleanQuery ||
        product.name.toLowerCase().includes(cleanQuery) ||
        product.sku.toLowerCase().includes(cleanQuery) ||
        product.category.toLowerCase().includes(cleanQuery);
      return matchesBrand && matchesQuery;
    });
  }, [brand, products, query]);
  const cartLines = Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = productById.get(productId);
      return product ? { product, quantity } : null;
    })
    .filter((line): line is { product: PosProduct; quantity: number } => Boolean(line));
  const subtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.quantity,
    0,
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const numericDiscount = discountValue === "" ? 0 : Number(discountValue);
  const discountError =
    !Number.isFinite(numericDiscount) || numericDiscount < 0
      ? "Enter a valid discount."
      : discountType === "PERCENTAGE" && numericDiscount > 100
        ? "Percentage cannot exceed 100%."
        : discountType === "FIXED_AMOUNT" && numericDiscount > subtotal
          ? "Discount cannot exceed the subtotal."
          : null;
  const discountAmount = discountError
    ? 0
    : Math.round(
        (discountType === "PERCENTAGE"
          ? subtotal * (numericDiscount / 100)
          : numericDiscount) * 100,
      ) / 100;
  const total = Math.max(0, subtotal - discountAmount);
  const selectedPopupStallId = popupStalls.some((stall) => stall.id === popupStallId)
    ? popupStallId
    : defaultStallId(popupStalls);
  const selectedPopupStall = popupStalls.find(
    (stall) => stall.id === selectedPopupStallId,
  );
  const needsStall = channel === "POP_UP_STALL";
  const checkoutDisabled =
    cartLines.length === 0 ||
    (needsStall && !selectedPopupStallId) ||
    Boolean(discountError) ||
    pending;

  function changeQuantity(product: PosProduct, change: number) {
    setNotice(null);
    setCart((current) => {
      const nextQuantity = (current[product.id] ?? 0) + change;
      if (nextQuantity > product.stockQuantity) {
        setNotice({
          ok: false,
          message: `${product.name} only has ${product.stockQuantity} in stock.`,
        });
        return current;
      }

      const next = { ...current };
      if (nextQuantity <= 0) delete next[product.id];
      else next[product.id] = nextQuantity;
      return next;
    });
  }

  function completeSale() {
    if (checkoutDisabled) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await checkout({
          salesChannel: channel,
          popupStallId: needsStall ? selectedPopupStallId : null,
          discountType: discountAmount > 0 ? discountType : "NONE",
          discountValue: discountAmount > 0 ? numericDiscount.toFixed(2) : "0",
          items: cartLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        });

        if (result.ok) {
          setCart({});
          setDiscountValue("");
          setChannel("POP_UP_STALL");
          setMobileCartOpen(false);
          setNotice({
            ok: true,
            message: `Sale completed · #${result.data.orderId.slice(0, 8).toUpperCase()}`,
          });
          router.refresh();
        } else {
          setNotice({ ok: false, message: result.message });
        }
      } catch {
        setNotice({
          ok: false,
          message: "The sale could not be completed. Your cart is unchanged; please try again.",
        });
      }
    });
  }

  function checkoutPanel(instance: "mobile" | "desktop") {
    return (
      <div className={`flex flex-col bg-zinc-950 ${instance === "mobile" ? "h-[92vh]" : "h-[calc(100vh-7rem)]"}`}>
        <div className="flex items-start justify-between border-b border-zinc-800 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Current sale</p>
            <h2 id={`${instance}-cart-heading`} className="mt-1 text-lg font-bold text-white">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </h2>
          </div>
          {instance === "mobile" ? (
            <button
              className="grid size-11 place-items-center border border-zinc-700 text-xl text-zinc-300"
              onClick={() => setMobileCartOpen(false)}
              type="button"
              aria-label="Close cart"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cartLines.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm leading-6 text-zinc-600">Tap a product to start this sale.</p>
          ) : (
            cartLines.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3 border-b border-zinc-900 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-200">{product.name}</p>
                  <p className="mt-1 text-xs tabular-nums text-zinc-600">{formatLkr(Number(product.price) * quantity)}</p>
                </div>
                <div className="flex items-center border border-zinc-700">
                  <button className="grid size-11 place-items-center text-lg text-zinc-300 hover:bg-zinc-800" onClick={() => changeQuantity(product, -1)} type="button" aria-label={`Remove one ${product.name}`}>−</button>
                  <span className="grid h-11 min-w-9 place-items-center border-x border-zinc-700 text-sm font-black tabular-nums text-white">{quantity}</span>
                  <button className="grid size-11 place-items-center text-lg text-zinc-300 hover:bg-zinc-800 disabled:text-zinc-700" disabled={quantity >= product.stockQuantity} onClick={() => changeQuantity(product, 1)} type="button" aria-label={`Add one ${product.name}`}>+</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4 border-t border-zinc-800 p-5">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Sales channel</legend>
            <div className="grid grid-cols-2 border border-zinc-700">
              {([
                ["POP_UP_STALL", "Pop-up stall"],
                ["ONLINE", "Online"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={channel === value}
                  className={`min-h-12 px-2 text-xs font-black uppercase tracking-[0.1em] ${channel === value ? "bg-white text-black" : "bg-black text-zinc-400 hover:text-white"}`}
                  onClick={() => { setChannel(value); setNotice(null); }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {needsStall ? (
            popupStalls.length > 0 ? (
              <label className="block text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                Which stall?
                <select className={`${controlClass} mt-2 normal-case`} onChange={(event) => setPopupStallId(event.target.value)} value={selectedPopupStallId}>
                  {popupStalls.map((stall) => (
                    <option key={stall.id} value={stall.id}>
                      {stall.name}{stall.location ? ` · ${stall.location}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-[11px] font-normal normal-case leading-5 text-zinc-600">
                  {selectedPopupStall
                    ? formatColomboDate(selectedPopupStall.startsAt)
                    : "Select an active stall"}
                </span>
              </label>
            ) : (
              <div className="border border-zinc-700 p-3 text-sm leading-5 text-zinc-400">
                Add an active event before recording a pop-up sale.{" "}
                <Link className="font-bold text-white underline underline-offset-4" href="/stalls">Manage stalls</Link>
              </div>
            )
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Discount · optional</p>
              {discountValue ? (
                <button className="text-xs font-bold text-zinc-500 hover:text-white" onClick={() => setDiscountValue("")} type="button">Clear</button>
              ) : null}
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)]">
              <select
                aria-label="Discount type"
                className="min-h-11 border border-r-0 border-zinc-700 bg-black px-2 text-xs font-bold text-white focus:border-white focus:outline-none"
                onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                value={discountType}
              >
                <option value="PERCENTAGE">Percent</option>
                <option value="FIXED_AMOUNT">LKR</option>
              </select>
              <input
                aria-label="Discount value"
                className={controlClass}
                inputMode="decimal"
                max={discountType === "PERCENTAGE" ? "100" : undefined}
                min="0"
                onChange={(event) => setDiscountValue(event.target.value)}
                placeholder={discountType === "PERCENTAGE" ? "0%" : "0.00"}
                step="0.01"
                type="number"
                value={discountValue}
              />
            </div>
            {discountError ? <p className="mt-2 text-xs text-zinc-400">{discountError}</p> : null}
          </div>

          <dl className="space-y-2 border-y border-zinc-800 py-4 text-sm">
            <div className="flex justify-between gap-4 text-zinc-500">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatLkr(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-zinc-500">
              <dt>Discount</dt>
              <dd className="tabular-nums">− {formatLkr(discountAmount)}</dd>
            </div>
            <div className="flex items-end justify-between gap-4 pt-2 text-white">
              <dt className="text-sm font-bold">Total</dt>
              <dd className="text-2xl font-black tracking-tight tabular-nums">{formatLkr(total)}</dd>
            </div>
          </dl>

          {notice && !notice.ok ? (
            <p className="border-l-2 border-zinc-600 pl-3 text-sm leading-5 text-zinc-400" aria-live="polite">{notice.message}</p>
          ) : null}

          <button
            className="min-h-14 w-full bg-white px-5 text-sm font-black uppercase tracking-[0.13em] text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            disabled={checkoutDisabled}
            onClick={completeSale}
            type="button"
          >
            {pending
              ? "Completing sale…"
              : needsStall && !selectedPopupStallId
                ? "Select a pop-up stall"
                : "Complete sale"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-7 pb-20 lg:grid-cols-[minmax(0,1fr)_390px] lg:pb-0">
      <section className="space-y-5" aria-labelledby="catalog-heading">
        {notice?.ok ? (
          <p className="border-l-2 border-white bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-200" aria-live="polite">{notice.message}</p>
        ) : null}

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Available now</p>
            <h2 id="catalog-heading" className="mt-1 text-lg font-bold text-white">Product catalog</h2>
          </div>
          <p className="text-xs text-zinc-600">{visibleProducts.length} shown</p>
        </div>

        <div className="sticky top-16 z-20 grid gap-2 border-y border-zinc-900 bg-black py-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:static lg:border-0 lg:py-0">
          <label>
            <span className="sr-only">Search products</span>
            <input className={controlClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" type="search" value={query} />
          </label>
          <label>
            <span className="sr-only">Filter by brand</span>
            <select className={controlClass} onChange={(event) => setBrand(event.target.value)} value={brand}>
              <option value="ALL">All brands</option>
              <option value="LOLARK">Lolark</option>
              <option value="MUNDHANAI">Mundhanai</option>
            </select>
          </label>
        </div>

        {visibleProducts.length === 0 ? (
          <EmptyState title={products.length === 0 ? "No products are ready to sell" : "No matching products"}>
            {products.length === 0
              ? "Add or restock an active product in Inventory, then return here."
              : "Try a different search or brand filter."}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const quantity = cart[product.id] ?? 0;
              const atLimit = quantity >= product.stockQuantity;
              return (
                <button
                  key={product.id}
                  aria-label={`Add ${product.name} to cart`}
                  className="group flex min-h-40 flex-col justify-between border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-zinc-500 active:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
                  disabled={pending || atLimit}
                  onClick={() => changeQuantity(product, 1)}
                  type="button"
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <Badge>{brandLabel(product.brand)}</Badge>
                      {quantity > 0 ? <span className="grid size-7 place-items-center bg-white text-xs font-black text-black">{quantity}</span> : null}
                    </div>
                    <h3 className="mt-3 text-sm font-bold leading-5 text-white">{product.name}</h3>
                    <p className="mt-1 text-[11px] text-zinc-600">{product.category}</p>
                  </div>
                  <div className="mt-3 w-full border-t border-zinc-900 pt-3">
                    <p className="text-sm font-black tabular-nums text-zinc-200">{formatLkr(product.price)}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-zinc-600">
                      {atLimit ? "All in cart" : `${product.stockQuantity} left · Tap to add`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-hidden border border-zinc-700 bg-zinc-950 lg:block" aria-labelledby="desktop-cart-heading">
        {checkoutPanel("desktop")}
      </aside>

      {!mobileCartOpen && itemCount > 0 ? (
        <button
          className="fixed inset-x-3 bottom-[4.75rem] z-40 flex min-h-16 items-center justify-between border border-zinc-600 bg-white px-5 text-black lg:hidden"
          onClick={() => setMobileCartOpen(true)}
          type="button"
        >
          <span className="text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">View cart</span>
            <span className="mt-1 block text-sm font-black">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </span>
          <span className="text-lg font-black tabular-nums">{formatLkr(total)}</span>
        </button>
      ) : null}

      {mobileCartOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/80 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-cart-heading">
          <div className="max-h-[92vh] w-full overflow-hidden border-t border-zinc-600">{checkoutPanel("mobile")}</div>
        </div>
      ) : null}
    </div>
  );
}
