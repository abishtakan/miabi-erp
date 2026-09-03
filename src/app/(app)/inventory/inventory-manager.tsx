"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  adjustStock,
  createProduct,
  setProductActive,
  updateProduct,
  type ActionResult,
  type ProductInput,
} from "@/app/actions";
import { Badge, EmptyState } from "@/components/ui";
import { brandLabel, formatLkr } from "@/lib/format";

type InventoryProduct = {
  id: string;
  sku: string;
  name: string;
  brand: "LOLARK" | "MUNDHANAI";
  category: string;
  price: string;
  stockQuantity: number;
  isActive: boolean;
};

type Panel =
  | { type: "add" }
  | { type: "edit"; product: InventoryProduct }
  | { type: "stock"; product: InventoryProduct }
  | null;

const fieldClass =
  "min-h-11 w-full border border-zinc-700 bg-black px-3 text-sm text-white placeholder:text-zinc-700 focus:border-white focus:outline-none disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center border border-zinc-700 px-3 text-xs font-bold uppercase tracking-[0.1em] text-zinc-300 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

function readProduct(form: HTMLFormElement): ProductInput {
  const formData = new FormData(form);
  return {
    sku: String(formData.get("sku") ?? ""),
    name: String(formData.get("name") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    category: String(formData.get("category") ?? ""),
    price: String(formData.get("price") ?? ""),
    openingStock: String(formData.get("openingStock") ?? "0"),
  };
}

function ProductForm({
  product,
  pending,
  onCancel,
  onSubmit,
}: {
  product?: InventoryProduct;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border border-zinc-700 bg-zinc-950 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            {product ? "Edit catalog entry" : "New catalog entry"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            {product ? product.name : "Add product"}
          </h2>
        </div>
        <button className={secondaryButton} onClick={onCancel} type="button">Cancel</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          SKU
          <input className={`${fieldClass} mt-2 font-mono uppercase`} defaultValue={product?.sku} maxLength={32} name="sku" placeholder="LOL-JHU-001" required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 sm:col-span-1 lg:col-span-2">
          Product name
          <input className={`${fieldClass} mt-2`} defaultValue={product?.name} maxLength={120} name="name" placeholder="Classic Pearl Jhumka" required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          Brand
          <select className={`${fieldClass} mt-2`} defaultValue={product?.brand ?? "LOLARK"} name="brand" required>
            <option value="LOLARK">Lolark</option>
            <option value="MUNDHANAI">Mundhanai</option>
          </select>
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          Category
          <input className={`${fieldClass} mt-2`} defaultValue={product?.category} maxLength={80} name="category" placeholder="Jhumka" required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          Price · LKR
          <input className={`${fieldClass} mt-2`} defaultValue={product?.price} inputMode="decimal" min="0.01" name="price" placeholder="3250.00" required step="0.01" type="number" />
        </label>
        {!product ? (
          <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
            Opening stock
            <input className={`${fieldClass} mt-2`} defaultValue="0" inputMode="numeric" min="0" name="openingStock" required step="1" type="number" />
          </label>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end">
        <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-400" disabled={pending} type="submit">
          {pending ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function StockForm({
  product,
  pending,
  onCancel,
  onSubmit,
}: {
  product: InventoryProduct;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border border-zinc-700 bg-zinc-950 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Stock adjustment</p>
          <h2 className="mt-1 text-xl font-bold text-white">{product.name}</h2>
          <p className="mt-1 text-sm text-zinc-500">Current balance: {product.stockQuantity}</p>
        </div>
        <button className={secondaryButton} onClick={onCancel} type="button">Cancel</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          Change type
          <select className={`${fieldClass} mt-2`} defaultValue="add" name="direction">
            <option value="add">Add / restock</option>
            <option value="remove">Remove / correct</option>
          </select>
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
          Quantity
          <input className={`${fieldClass} mt-2`} inputMode="numeric" min="1" name="quantity" placeholder="1" required step="1" type="number" />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 sm:col-span-3">
          Reason
          <input className={`${fieldClass} mt-2`} maxLength={240} name="note" placeholder="New delivery received" required />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-400" disabled={pending} type="submit">
          {pending ? "Updating…" : "Update stock"}
        </button>
      </div>
    </form>
  );
}

export function InventoryManager({ products }: { products: InventoryProduct[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !cleanQuery ||
        product.sku.toLowerCase().includes(cleanQuery) ||
        product.name.toLowerCase().includes(cleanQuery) ||
        product.category.toLowerCase().includes(cleanQuery);
      const matchesBrand = brand === "ALL" || product.brand === brand;
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" ? product.isActive : !product.isActive);
      return matchesQuery && matchesBrand && matchesStatus;
    });
  }, [brand, products, query, status]);

  function run(action: Promise<ActionResult<unknown>>, closeOnSuccess = true) {
    setNotice(null);
    startTransition(async () => {
      const result = await action;
      setNotice({ ok: result.ok, message: result.message });
      if (result.ok) {
        if (closeOnSuccess) setPanel(null);
        router.refresh();
      }
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = readProduct(event.currentTarget);
    if (panel?.type === "edit") run(updateProduct(panel.product.id, input));
    else run(createProduct(input));
  }

  function submitStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (panel?.type !== "stock") return;
    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity"));
    const direction = formData.get("direction") === "remove" ? -1 : 1;
    run(adjustStock(panel.product.id, quantity * direction, String(formData.get("note") ?? "")));
  }

  function toggleProduct(product: InventoryProduct) {
    if (product.isActive && !window.confirm(`Archive ${product.name}? It will be removed from POS.`)) return;
    run(setProductActive(product.id, !product.isActive), false);
  }

  function Actions({ product }: { product: InventoryProduct }) {
    return (
      <div className="flex flex-wrap gap-2 md:justify-end">
        <button className={secondaryButton} disabled={pending} onClick={() => { setPanel({ type: "edit", product }); setNotice(null); }} type="button">Edit</button>
        <button className={secondaryButton} disabled={pending} onClick={() => { setPanel({ type: "stock", product }); setNotice(null); }} type="button">Adjust</button>
        <button className={`${secondaryButton} ${product.isActive ? "text-zinc-500" : "text-white"}`} disabled={pending} onClick={() => toggleProduct(product)} type="button">
          {product.isActive ? "Archive" : "Restore"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {products.filter((product) => product.isActive).length} active products · {products.reduce((sum, product) => sum + product.stockQuantity, 0)} units
        </p>
        <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200" onClick={() => { setPanel({ type: "add" }); setNotice(null); }} type="button">
          Add product
        </button>
      </div>

      {panel?.type === "add" ? <ProductForm pending={pending} onCancel={() => setPanel(null)} onSubmit={submitProduct} /> : null}
      {panel?.type === "edit" ? <ProductForm pending={pending} product={panel.product} onCancel={() => setPanel(null)} onSubmit={submitProduct} /> : null}
      {panel?.type === "stock" ? <StockForm pending={pending} product={panel.product} onCancel={() => setPanel(null)} onSubmit={submitStock} /> : null}

      {notice ? (
        <p className={`border-l-2 px-3 py-2 text-sm ${notice.ok ? "border-white text-zinc-200" : "border-zinc-600 text-zinc-400"}`} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="sm:col-span-1">
          <span className="sr-only">Search inventory</span>
          <input className={fieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, category…" type="search" value={query} />
        </label>
        <label>
          <span className="sr-only">Filter by brand</span>
          <select className={fieldClass} onChange={(event) => setBrand(event.target.value)} value={brand}>
            <option value="ALL">All brands</option>
            <option value="LOLARK">Lolark</option>
            <option value="MUNDHANAI">Mundhanai</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select className={fieldClass} onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="ACTIVE">Active products</option>
            <option value="ARCHIVED">Archived products</option>
            <option value="ALL">All statuses</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching products">Try a different filter, or add a new product to the catalog.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((product) => (
              <article key={product.id} className="border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-zinc-600">{product.sku}</p>
                    <h2 className="mt-1 font-bold text-white">{product.name}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{product.category}</p>
                  </div>
                  <Badge muted={!product.isActive}>{product.isActive ? brandLabel(product.brand) : "Archived"}</Badge>
                </div>
                <div className="my-4 flex items-end justify-between border-y border-zinc-900 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Price</p>
                    <p className="mt-1 text-sm font-bold text-zinc-200">{formatLkr(product.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Stock</p>
                    <p className={`mt-1 text-2xl font-black ${product.stockQuantity <= 2 ? "text-zinc-400" : "text-white"}`}>{product.stockQuantity}</p>
                  </div>
                </div>
                <Actions product={product} />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto border border-zinc-800 md:block">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-zinc-950 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className={`border-t border-zinc-900 ${product.isActive ? "" : "opacity-55"}`}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">{product.name}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-600">{product.sku} · {product.category}</p>
                    </td>
                    <td className="px-4 py-4"><Badge muted={!product.isActive}>{product.isActive ? brandLabel(product.brand) : "Archived"}</Badge></td>
                    <td className="px-4 py-4 text-sm font-bold tabular-nums text-zinc-300">{formatLkr(product.price)}</td>
                    <td className="px-4 py-4 text-right text-xl font-black tabular-nums text-white">{product.stockQuantity}</td>
                    <td className="px-4 py-4"><Actions product={product} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
