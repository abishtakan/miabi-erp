import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, DatabaseSetup, EmptyState, PageHeader } from "@/components/ui";
import { channelLabel, formatColomboDate, formatLkr } from "@/lib/format";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { DeleteOrderButton } from "../delete-order-button";

export const metadata: Metadata = { title: "All orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!isDatabaseConfigured) return <DatabaseSetup />;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      salesChannel: true,
      totalAmount: true,
      items: { select: { quantity: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales history"
        title="All orders"
        description="A complete log of every recorded sale across all channels."
      />

      <section aria-labelledby="all-orders-heading">
        <h2 id="all-orders-heading" className="sr-only">Order list</h2>

        {orders.length === 0 ? (
          <EmptyState title="No sales yet">
            Complete the first sale in POS and it will appear here immediately.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto border border-zinc-800">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead className="bg-zinc-950 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Order</th>
                  <th className="px-4 py-3 font-bold">When</th>
                  <th className="px-4 py-3 font-bold">Channel</th>
                  <th className="px-4 py-3 text-right font-bold">Items</th>
                  <th className="px-4 py-3 text-right font-bold">Total</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-zinc-900 text-sm">
                    <td className="px-4 py-4 font-mono text-xs font-bold text-zinc-300">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{formatColomboDate(order.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Badge>{channelLabel(order.salesChannel)}</Badge>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-zinc-400">
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold tabular-nums text-white">
                      {formatLkr(order.totalAmount.toString())}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DeleteOrderButton orderId={order.id} />
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
