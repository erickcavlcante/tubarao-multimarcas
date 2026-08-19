import { prisma } from "@/lib/prisma";

const PRODUCT_INCLUDE = {
  category: true,
  variations: true,
} as const;

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getRecentActiveProducts(limit: number) {
  return prisma.product.findMany({
    where: { active: true, variations: { some: {} } },
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
