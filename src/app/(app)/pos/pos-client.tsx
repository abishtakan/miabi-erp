"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkout } from "@/app/actions";
import { Badge, EmptyState } from "@/components/ui";
import { brandLabel, formatLkr } from "@/lib/format";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  brand: "LOLARK" | "MUNDHANAI";
  category: string;
  price: string;
  stockQuantity: number;
};

type Channel = "ONLINE" | "POP_UP_STALL";

const controlClass =
  "min-h-11 w-full border border-zinc-700 bg-black px-3 text-sm text-white placeholder:text-zinc-700 focus:border-white focus:outline-none";

export function PosClient({ products }: { products: PosProduct[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [channel, setChannel] = useState<Channel | null>(null);
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
  const total = cartLines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.quantity,
    0,
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

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
    if (!channel || cartLines.length === 0 || pending) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await checkout({
          salesChannel: channel,
          items: cartLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        });

        if (result.ok) {
          setCart({});
          setChannel(null);
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

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="order-2 space-y-5 lg:order-1" aria-labelledby="catalog-heading">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Available now</p>
            <h2 id="catalog-heading" className="mt-1 text-lg font-bold text-white">Product catalog</h2>
          </div>
          <p className="text-xs text-zinc-600">{visibleProducts.length} shown</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const quantity = cart[product.id] ?? 0;
              const atLimit = quantity >= product.stockQuantity;
              return (
                <button
                  key={product.id}
                  aria-label={`Add ${product.name} to cart`}
                  className="group flex min-h-44 flex-col justify-between border border-zinc-800 bg-zinc-950 p-4 text-left hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pending || atLimit}
                  onClick={() => changeQuantity(product, 1)}
                  type="button"
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <Badge>{brandLabel(product.brand)}</Badge>
                      {quantity > 0 ? (
                        <span className="grid size-7 place-items-center bg-white text-xs font-black text-black">{quantity}</span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-sm font-bold leading-5 text-white">{product.name}</h3>
                    <p className="mt-1 text-[11px] text-zinc-600">{product.category}</p>
                  </div>
                  <div className="mt-4 w-full border-t border-zinc-900 pt-3">
                    <p className="text-sm font-black tabular-nums text-zinc-200">{formatLkr(product.price)}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      {atLimit ? "All in cart" : `${product.stockQuantity} in stock · Tap to add`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="order-1 border border-zinc-700 bg-zinc-950 lg:sticky lg:top-24 lg:order-2" aria-labelledby="cart-heading">
        <div className="border-b border-zinc-800 p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Current sale</p>
              <h2 id="cart-heading" className="mt-1 text-lg font-bold text-white">Cart</h2>
            </div>
            <p className="text-xs text-zinc-500">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
          </div>
          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{formatLkr(total)}</p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {cartLines.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm leading-6 text-zinc-600">Tap a product to start this sale.</p>
          ) : (
            cartLines.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3 border-b border-zinc-900 px-5 py-4">
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

        <div className="space-y-4 p-5">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Sales channel · required</legend>
            <div className="grid grid-cols-2 border border-zinc-700">
              {([
                ["ONLINE", "Online"],
                ["POP_UP_STALL", "Pop-up stall"],
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

          {notice ? (
            <p className={`border-l-2 pl-3 text-sm leading-5 ${notice.ok ? "border-white text-zinc-200" : "border-zinc-600 text-zinc-400"}`} aria-live="polite">
              {notice.message}
            </p>
          ) : null}

          <button
            className="min-h-14 w-full bg-white px-5 text-sm font-black uppercase tracking-[0.13em] text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            disabled={cartLines.length === 0 || !channel || pending}
            onClick={completeSale}
            type="button"
          >
            {pending ? "Completing sale…" : !channel && cartLines.length > 0 ? "Select sales channel" : "Complete sale"}
          </button>
        </div>
      </aside>
    </div>
  );
}
