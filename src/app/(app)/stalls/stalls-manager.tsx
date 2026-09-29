"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addStallExpense,
  createPopupStall,
  deleteStallExpense,
  setPopupStallActive,
  updatePopupStall,
  updateStallExpense,
  type ActionResult,
  type ExpenseInput,
  type PopupStallInput,
} from "@/app/actions";
import { Badge, EmptyState } from "@/components/ui";
import { formatColomboDate, formatColomboDay, formatLkr } from "@/lib/format";

type ExpenseCategory = "STALL_FEE" | "FOOD" | "TRANSPORT" | "OTHER";

type StallSummary = {
  id: string;
  name: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  revenue: string;
  productCost: string;
  orderCount: number;
  expenses: Record<ExpenseCategory, string>;
};

type RecentExpense = {
  id: string;
  popupStallId: string;
  popupStallName: string;
  category: ExpenseCategory;
  amount: string;
  note: string | null;
  incurredAt: string;
};

type Panel =
  | { type: "stall"; stall?: StallSummary }
  | { type: "expense"; popupStallId?: string; editExpense?: RecentExpense }
  | null;

const fieldClass =
  "min-h-11 w-full border border-zinc-700 bg-black px-3 text-sm text-white placeholder:text-zinc-700 focus:border-white focus:outline-none disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center border border-zinc-700 px-3 text-xs font-bold uppercase tracking-[0.1em] text-zinc-300 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

const categoryLabels: Record<ExpenseCategory, string> = {
  STALL_FEE: "Stall fee",
  FOOD: "Food",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

function toColomboInput(value: string | Date = new Date()) {
  const date = new Date(value);
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function colomboDateTimeToIso(value: string) {
  return new Date(`${value}:00+05:30`).toISOString();
}

function todayInColombo() {
  return toColomboInput().slice(0, 10);
}

function totalExpenses(stall: StallSummary) {
  return Object.values(stall.expenses).reduce((sum, value) => sum + Number(value), 0);
}

export function StallsManager({
  stalls,
  recentExpenses,
}: {
  stalls: StallSummary[];
  recentExpenses: RecentExpense[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const visibleStalls = showArchived
    ? stalls
    : stalls.filter((stall) => stall.isActive);
  const totals = useMemo(
    () =>
      stalls.reduce(
        (summary, stall) => {
          summary.revenue += Number(stall.revenue);
          summary.productCost += Number(stall.productCost);
          summary.expenses += totalExpenses(stall);
          summary.orders += stall.orderCount;
          return summary;
        },
        { revenue: 0, productCost: 0, expenses: 0, orders: 0 },
      ),
    [stalls],
  );

  function run<T>(action: Promise<ActionResult<T>>) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action;
        setNotice({ ok: result.ok, message: result.message });
        if (result.ok) {
          setPanel(null);
          router.refresh();
        }
      } catch {
        setNotice({ ok: false, message: "The change could not be saved. Please try again." });
      }
    });
  }

  function submitStall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    const input: PopupStallInput = {
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      startsAt: colomboDateTimeToIso(startsAt),
      endsAt: endsAt ? colomboDateTimeToIso(endsAt) : "",
    };
    if (panel?.type === "stall" && panel.stall) {
      run(updatePopupStall(panel.stall.id, input));
    } else {
      run(createPopupStall(input));
    }
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const date = String(formData.get("incurredAt") ?? "");
    const input: ExpenseInput = {
      popupStallId: String(formData.get("popupStallId") ?? ""),
      category: String(formData.get("category") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      incurredAt: new Date(`${date}T12:00:00+05:30`).toISOString(),
      note: String(formData.get("note") ?? ""),
    };
    if (panel?.type === "expense" && panel.editExpense) {
      run(updateStallExpense(panel.editExpense.id, input));
    } else {
      run(addStallExpense(input));
    }
  }

  function handleDeleteExpense(expense: RecentExpense) {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      run(deleteStallExpense(expense.id));
    }
  }

  function toggleStall(stall: StallSummary) {
    if (stall.isActive && !window.confirm(`Archive ${stall.name}? It will no longer be available in POS.`)) return;
    run(setPopupStallActive(stall.id, !stall.isActive));
  }

  const editStall = panel?.type === "stall" ? panel.stall : undefined;
  const editExpense = panel?.type === "expense" ? panel.editExpense : undefined;
  const expenseStallId =
    panel?.type === "expense" && panel.popupStallId
      ? panel.popupStallId
      : stalls.find((stall) => stall.isActive)?.id ?? stalls[0]?.id ?? "";

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Pop-up totals">
        {[
          ["Stall revenue", formatLkr(totals.revenue)],
          ["Product cost", formatLkr(totals.productCost)],
          ["Tracked expenses", formatLkr(totals.expenses)],
          ["Net contribution", formatLkr(totals.revenue - totals.productCost - totals.expenses)],
          ["Stall orders", totals.orders.toLocaleString("en-LK")],
        ].map(([label, value]) => (
          <div key={label} className="border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
            <p className="mt-5 break-words text-2xl font-black tracking-tight text-white">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-400">
          <input checked={showArchived} className="size-4 accent-white" onChange={(event) => setShowArchived(event.target.checked)} type="checkbox" />
          Show archived stalls
        </label>
        <div className="flex gap-2">
          <button className={secondaryButton} disabled={stalls.length === 0} onClick={() => { setPanel({ type: "expense" }); setNotice(null); }} type="button">Record expense</button>
          <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200" onClick={() => { setPanel({ type: "stall" }); setNotice(null); }} type="button">Add stall</button>
        </div>
      </div>

      {panel?.type === "stall" ? (
        <form className="border border-zinc-700 bg-zinc-950 p-4 sm:p-6" onSubmit={submitStall}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Event details</p>
              <h2 className="mt-1 text-xl font-bold text-white">{editStall ? `Edit ${editStall.name}` : "Add pop-up stall"}</h2>
            </div>
            <button className={secondaryButton} onClick={() => setPanel(null)} type="button">Cancel</button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Stall name
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editStall?.name} maxLength={100} name="name" placeholder="Colombo Design Market · September" required />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Location · optional
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editStall?.location ?? ""} maxLength={120} name="location" placeholder="One Galle Face" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Starts
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={toColomboInput(editStall?.startsAt)} name="startsAt" required type="datetime-local" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Ends · optional
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editStall?.endsAt ? toColomboInput(editStall.endsAt) : ""} name="endsAt" type="datetime-local" />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black disabled:bg-zinc-700" disabled={pending} type="submit">{pending ? "Saving…" : editStall ? "Save changes" : "Add stall"}</button>
          </div>
        </form>
      ) : null}

      {panel?.type === "expense" ? (
        <form className="border border-zinc-700 bg-zinc-950 p-4 sm:p-6" onSubmit={submitExpense}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Event cost</p>
              <h2 className="mt-1 text-xl font-bold text-white">{editExpense ? "Edit expense" : "Record expense"}</h2>
            </div>
            <button className={secondaryButton} onClick={() => setPanel(null)} type="button">Cancel</button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 sm:col-span-2">
              Pop-up stall
              <select className={`${fieldClass} mt-2 normal-case`} defaultValue={editExpense?.popupStallId ?? expenseStallId} name="popupStallId" required>
                {stalls.map((stall) => <option key={stall.id} value={stall.id}>{stall.name}{stall.isActive ? "" : " · archived"}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Category
              <select className={`${fieldClass} mt-2 normal-case`} defaultValue={editExpense?.category ?? "STALL_FEE"} name="category">
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Amount · LKR
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editExpense?.amount} inputMode="decimal" min="0.01" name="amount" placeholder="5000.00" required step="0.01" type="number" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Date
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editExpense ? toColomboInput(editExpense.incurredAt).slice(0, 10) : todayInColombo()} name="incurredAt" required type="date" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 sm:col-span-2 lg:col-span-3">
              Note · optional
              <input className={`${fieldClass} mt-2 normal-case`} defaultValue={editExpense?.note ?? ""} maxLength={240} name="note" placeholder="Table and electricity fee" />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="min-h-11 bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black disabled:bg-zinc-700" disabled={pending} type="submit">{pending ? "Saving…" : editExpense ? "Save changes" : "Record expense"}</button>
          </div>
        </form>
      ) : null}

      {notice ? (
        <p className={`border-l-2 px-3 py-2 text-sm ${notice.ok ? "border-white text-zinc-200" : "border-zinc-600 text-zinc-400"}`} aria-live="polite">{notice.message}</p>
      ) : null}

      <section aria-labelledby="events-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Per event</p>
            <h2 id="events-heading" className="mt-1 text-lg font-bold text-white">Stall performance</h2>
          </div>
          <p className="text-xs text-zinc-600">Revenue after discounts</p>
        </div>
        {visibleStalls.length === 0 ? (
          <EmptyState title={stalls.length === 0 ? "No pop-up stalls yet" : "No active stalls"}>
            {stalls.length === 0 ? "Add the next event, then it will become the default selection in POS." : "Show archived stalls or add the next event."}
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleStalls.map((stall) => {
              const expenses = totalExpenses(stall);
              const productCost = Number(stall.productCost);
              const net = Number(stall.revenue) - productCost - expenses;
              return (
                <article key={stall.id} className={`border border-zinc-800 bg-zinc-950 p-5 sm:p-6 ${stall.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge muted={!stall.isActive}>{stall.isActive ? "Active" : "Archived"}</Badge>
                      <h3 className="mt-3 text-xl font-bold text-white">{stall.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{stall.location || "Location not set"}</p>
                      <p className="mt-2 text-xs text-zinc-600">{formatColomboDate(stall.startsAt)}{stall.endsAt ? ` → ${formatColomboDate(stall.endsAt)}` : ""}</p>
                    </div>
                    <p className="text-right text-xs text-zinc-600">{stall.orderCount} {stall.orderCount === 1 ? "order" : "orders"}</p>
                  </div>
                  <dl className="mt-6 grid grid-cols-2 border-y border-zinc-800 py-4 text-center sm:grid-cols-4">
                    <div className="border-r border-zinc-800 px-2">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Revenue</dt>
                      <dd className="mt-2 text-sm font-black text-white">{formatLkr(stall.revenue)}</dd>
                    </div>
                    <div className="border-r border-zinc-800 px-2">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Product cost</dt>
                      <dd className="mt-2 text-sm font-black text-zinc-300">{formatLkr(productCost)}</dd>
                    </div>
                    <div className="border-r border-zinc-800 px-2">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Expenses</dt>
                      <dd className="mt-2 text-sm font-black text-zinc-300">{formatLkr(expenses)}</dd>
                    </div>
                    <div className="px-2">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Net</dt>
                      <dd className={`mt-2 text-sm font-black ${net < 0 ? "text-zinc-500" : "text-white"}`}>{formatLkr(net)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {(Object.keys(categoryLabels) as ExpenseCategory[]).map((category) => (
                      <div key={category} className="flex justify-between gap-3 text-zinc-500">
                        <span>{categoryLabels[category]}</span>
                        <span className="tabular-nums text-zinc-300">{formatLkr(stall.expenses[category])}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button className={secondaryButton} onClick={() => { setPanel({ type: "expense", popupStallId: stall.id }); setNotice(null); }} type="button">Add expense</button>
                    <button className={secondaryButton} onClick={() => { setPanel({ type: "stall", stall }); setNotice(null); }} type="button">Edit</button>
                    <button className={`${secondaryButton} text-zinc-500`} onClick={() => toggleStall(stall)} type="button">{stall.isActive ? "Archive" : "Restore"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="expenses-heading">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Cost log</p>
          <h2 id="expenses-heading" className="mt-1 text-lg font-bold text-white">Recent expenses</h2>
        </div>
        {recentExpenses.length === 0 ? (
          <EmptyState title="No expenses recorded">Record stall fees, food, transport, and other event costs here.</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-zinc-800">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-zinc-950 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Stall</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Note</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {recentExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-zinc-900">
                    <td className="px-4 py-4 text-zinc-500">{formatColomboDay(expense.incurredAt)}</td>
                    <td className="px-4 py-4 font-bold text-zinc-200">{expense.popupStallName}</td>
                    <td className="px-4 py-4"><Badge>{categoryLabels[expense.category]}</Badge></td>
                    <td className="max-w-64 truncate px-4 py-4 text-zinc-500">{expense.note || "—"}</td>
                    <td className="px-4 py-4 text-right font-bold tabular-nums text-white">{formatLkr(expense.amount)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="text-xs font-bold text-zinc-400 hover:text-white" onClick={() => { setPanel({ type: "expense", editExpense: expense }); setNotice(null); }} type="button">Edit</button>
                        <button className="text-xs font-bold text-zinc-400 hover:text-red-400" onClick={() => handleDeleteExpense(expense)} type="button">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
