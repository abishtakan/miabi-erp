import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand, SalesChannel } from "@prisma/client";
import { Badge, DatabaseSetup, EmptyState, PageHeader } from "@/components/ui";
import { brandLabel, channelLabel, formatColomboDate, formatLkr } from "@/lib/format";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { DeleteOrderButton } from "./delete-order-button";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-6 break-words text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export default async function DashboardPage() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!isDatabaseConfigured) return <DatabaseSetup />;

  const [
    summary,
    expenseSummary,
    zeroCostSaleLines,
    channelGroups,
    brandGroups,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true, discountAmount: true, costAmount: true },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
    }),
    prisma.orderItem.count({ where: { costAtCheckout: 0 } }),
    prisma.order.groupBy({
      by: ["salesChannel"],
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["brandAtCheckout"],
      _sum: { netLineTotal: true, lineCostTotal: true },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        salesChannel: true,
        totalAmount: true,
        items: { select: { quantity: true } },
      },
    }),
  ]);

  const brandData = new Map(
    brandGroups.map((group) => {
      const revenue = Number(group._sum.netLineTotal?.toString() ?? "0");
      const cost = Number(group._sum.lineCostTotal?.toString() ?? "0");
      return [
        group.brandAtCheckout,
        { revenue, profit: revenue - cost },
      ];
    }),
  );
  const channels = new Map(
    channelGroups.map((group) => [
      group.salesChannel,
      {
        revenue: group._sum.totalAmount?.toString() ?? "0",
        orders: group._count._all,
      },
    ]),
  );
  const revenue = Number(summary._sum.totalAmount?.toString() ?? "0");
  const productCost = Number(summary._sum.costAmount?.toString() ?? "0");
  const stallExpenses = Number(expenseSummary._sum.amount?.toString() ?? "0");
  const netProfit = revenue - productCost - stallExpenses;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Today at MIABI"
        title="Business overview"
        description="A live view of sales across Lolark and Mundhanai. All amounts are in Sri Lankan rupees."
        action={
          <Link
            href="/pos"
            className="inline-flex min-h-11 items-center justify-center bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200"
          >
            New sale
          </Link>
        }
      />

      <section aria-labelledby="performance-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">All time</p>
            <h2 id="performance-heading" className="mt-1 text-lg font-bold text-zinc-100">
              Performance
            </h2>
          </div>
          <p className="text-xs text-zinc-600">Live from completed orders</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total revenue"
            value={formatLkr(revenue)}
            detail="Sales after discounts"
          />
          <MetricCard
            label="Recorded net profit"
            value={formatLkr(netProfit)}
            detail={zeroCostSaleLines > 0 ? `${zeroCostSaleLines} sold line(s) have zero recorded cost` : "Revenue minus product cost and stall expenses"}
          />
          <MetricCard
            label="Product cost"
            value={formatLkr(productCost)}
            detail="Cost captured at checkout"
          />
          <MetricCard
            label="Stall expenses"
            value={formatLkr(stallExpenses)}
            detail="Fees, food, transport, and other"
          />
          <MetricCard
            label="Total orders"
            value={summary._count._all.toLocaleString("en-LK")}
            detail="Successful checkouts"
          />
          <MetricCard
            label="Discounts"
            value={formatLkr(summary._sum.discountAmount?.toString() ?? "0")}
            detail="Total checkout discounts"
          />
          <MetricCard
            label={`${brandLabel(Brand.LOLARK)} revenue`}
            value={formatLkr(brandData.get(Brand.LOLARK)?.revenue ?? 0)}
            detail="Sales after discounts"
          />
          <MetricCard
            label={`${brandLabel(Brand.LOLARK)} profit`}
            value={formatLkr(brandData.get(Brand.LOLARK)?.profit ?? 0)}
            detail="Revenue minus product cost"
          />
          <MetricCard
            label={`${brandLabel(Brand.MUNDHANAI)} revenue`}
            value={formatLkr(brandData.get(Brand.MUNDHANAI)?.revenue ?? 0)}
            detail="Sales after discounts"
          />
          <MetricCard
            label={`${brandLabel(Brand.MUNDHANAI)} profit`}
            value={formatLkr(brandData.get(Brand.MUNDHANAI)?.profit ?? 0)}
            detail="Revenue minus product cost"
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-labelledby="channels-heading">
        <h2 id="channels-heading" className="sr-only">Sales channels</h2>
        {[SalesChannel.ONLINE, SalesChannel.POP_UP_STALL].map((channel) => {
          const channelData = channels.get(channel) ?? { revenue: "0", orders: 0 };
          return (
            <div key={channel} className="flex items-center justify-between border-y border-zinc-800 py-5">
              <div>
                <p className="text-sm font-bold text-zinc-200">{channelLabel(channel)}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {channelData.orders} {channelData.orders === 1 ? "order" : "orders"}
                </p>
              </div>
              <p className="text-lg font-black tracking-tight text-white">{formatLkr(channelData.revenue)}</p>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="recent-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Latest activity</p>
            <h2 id="recent-heading" className="mt-1 text-lg font-bold text-zinc-100">Recent orders</h2>
          </div>
          <Link href="/orders" className="text-xs font-bold uppercase tracking-[0.12em] text-white underline underline-offset-4 hover:text-zinc-300">View all</Link>
        </div>

        {recentOrders.length === 0 ? (
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
                {recentOrders.map((order) => (
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
