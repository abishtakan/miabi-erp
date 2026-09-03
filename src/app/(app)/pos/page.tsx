import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { PosClient } from "./pos-client";

export const metadata: Metadata = { title: "Point of sale" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!isDatabaseConfigured) return <DatabaseSetup />;

  const [products, popupStalls] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stockQuantity: { gt: 0 } },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        stockQuantity: true,
      },
    }),
    prisma.popupStall.findMany({
      where: { isActive: true },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        name: true,
        location: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Fast checkout"
        title="Point of sale"
        description="Tap products, select the sales channel, and complete the order. Current database prices and stock are checked again at checkout."
      />
      <PosClient
        products={products.map((product) => ({
          ...product,
          price: product.price.toString(),
        }))}
        popupStalls={popupStalls.map((stall) => ({
          ...stall,
          startsAt: stall.startsAt.toISOString(),
          endsAt: stall.endsAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
