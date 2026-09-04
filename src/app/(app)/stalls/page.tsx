import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { StallsManager } from "./stalls-manager";

export const metadata: Metadata = { title: "Pop-up stalls" };
export const dynamic = "force-dynamic";

export default async function StallsPage() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!isDatabaseConfigured) return <DatabaseSetup />;

  const [stalls, orderGroups, expenseGroups, recentExpenses] = await Promise.all([
    prisma.popupStall.findMany({
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        name: true,
        location: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    }),
    prisma.order.groupBy({
      by: ["popupStallId"],
      where: { popupStallId: { not: null } },
      _count: { _all: true },
      _sum: { totalAmount: true, costAmount: true },
    }),
    prisma.expense.groupBy({
      by: ["popupStallId", "category"],
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      take: 30,
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        popupStallId: true,
        category: true,
        amount: true,
        note: true,
        incurredAt: true,
        popupStall: { select: { name: true } },
      },
    }),
  ]);

  const ordersByStall = new Map(
    orderGroups
      .filter((group) => group.popupStallId)
      .map((group) => [
        group.popupStallId as string,
        {
          orderCount: group._count._all,
          revenue: group._sum.totalAmount?.toString() ?? "0",
          productCost: group._sum.costAmount?.toString() ?? "0",
        },
      ]),
  );
  const expensesByStall = new Map<
    string,
    Record<"STALL_FEE" | "FOOD" | "TRANSPORT" | "OTHER", string>
  >();
  for (const group of expenseGroups) {
    const current = expensesByStall.get(group.popupStallId) ?? {
      STALL_FEE: "0",
      FOOD: "0",
      TRANSPORT: "0",
      OTHER: "0",
    };
    current[group.category] = group._sum.amount?.toString() ?? "0";
    expensesByStall.set(group.popupStallId, current);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Event performance"
        title="Pop-up stalls"
        description="Compare each event's revenue, checkout-snapshotted product cost, tracked expenses, and net contribution."
      />
      <StallsManager
        stalls={stalls.map((stall) => ({
          ...stall,
          startsAt: stall.startsAt.toISOString(),
          endsAt: stall.endsAt?.toISOString() ?? null,
          revenue: ordersByStall.get(stall.id)?.revenue ?? "0",
          productCost: ordersByStall.get(stall.id)?.productCost ?? "0",
          orderCount: ordersByStall.get(stall.id)?.orderCount ?? 0,
          expenses: expensesByStall.get(stall.id) ?? {
            STALL_FEE: "0",
            FOOD: "0",
            TRANSPORT: "0",
            OTHER: "0",
          },
        }))}
        recentExpenses={recentExpenses.map((expense) => ({
          ...expense,
          amount: expense.amount.toString(),
          incurredAt: expense.incurredAt.toISOString(),
          popupStallName: expense.popupStall.name,
        }))}
      />
    </div>
  );
}
