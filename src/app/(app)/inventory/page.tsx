import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { InventoryManager } from "./inventory-manager";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!isDatabaseConfigured) return <DatabaseSetup />;

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { brand: "asc" }, { name: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      category: true,
      price: true,
      stockQuantity: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog control"
        title="Inventory"
        description="Maintain products, record stock changes, and archive anything that should no longer appear at checkout."
      />
      <InventoryManager
        products={products.map((product) => ({
          ...product,
          price: product.price.toString(),
        }))}
      />
    </div>
  );
}
