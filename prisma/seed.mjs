import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { sku: "LOL-JHU-001", name: "Classic Pearl Jhumka", brand: "LOLARK", category: "Jhumka", price: "3250.00", costPrice: "1500.00", stockQuantity: 8 },
  { sku: "LOL-NOS-001", name: "Silver Bloom Nose Pin", brand: "LOLARK", category: "Nose Pin", price: "1450.00", costPrice: "600.00", stockQuantity: 12 },
  { sku: "LOL-EAR-001", name: "Moon Drop Earrings", brand: "LOLARK", category: "Earrings", price: "2800.00", costPrice: "1200.00", stockQuantity: 7 },
  { sku: "LOL-NEC-001", name: "Temple Coin Necklace", brand: "LOLARK", category: "Necklace", price: "6900.00", costPrice: "3400.00", stockQuantity: 4 },
  { sku: "LOL-BAN-001", name: "Hammered Gold-Tone Bangle", brand: "LOLARK", category: "Bangle", price: "2200.00", costPrice: "900.00", stockQuantity: 10 },
  { sku: "MUN-SEM-001", name: "Ivory Kalyani Semi Silk Saree", brand: "MUNDHANAI", category: "Semi Silk", price: "12800.00", costPrice: "7800.00", stockQuantity: 3 },
  { sku: "MUN-ART-001", name: "Midnight Blue Art Silk Saree", brand: "MUNDHANAI", category: "Art Silk", price: "8750.00", costPrice: "5100.00", stockQuantity: 5 },
  { sku: "MUN-SOF-001", name: "Rosewood Soft Silk Saree", brand: "MUNDHANAI", category: "Soft Silk", price: "16500.00", costPrice: "10200.00", stockQuantity: 2 },
  { sku: "MUN-COT-001", name: "Sage Handloom Cotton Saree", brand: "MUNDHANAI", category: "Cotton", price: "7200.00", costPrice: "4100.00", stockQuantity: 6 },
  { sku: "MUN-LIN-001", name: "Sand Linen Blend Saree", brand: "MUNDHANAI", category: "Linen", price: "9900.00", costPrice: "5900.00", stockQuantity: 4 },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        isActive: true,
      },
      create: {
        ...product,
        stockMovements: {
          create: {
            type: "OPENING",
            quantityChange: product.stockQuantity,
            balanceAfter: product.stockQuantity,
            note: "Demo opening stock",
          },
        },
      },
    });
  }
}

main()
  .then(() => console.log(`Seeded ${products.length} MIABI products.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
