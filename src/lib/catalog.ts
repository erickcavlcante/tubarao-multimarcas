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

export type ProductFilters = {
  categorySlug?: string;
  size?: string;
  color?: string;
  brand?: string;
  sort?: "recentes" | "menor-preco" | "maior-preco";
};

export async function getFilteredProducts(filters: ProductFilters) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      variations: { some: {} },
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
      ...(filters.brand ? { brand: filters.brand } : {}),
      ...(filters.size || filters.color
        ? {
            variations: {
              some: {
                ...(filters.size ? { size: filters.size } : {}),
                ...(filters.color ? { color: filters.color } : {}),
              },
            },
          }
        : {}),
    },
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const withMinPrice = products.map((p) => ({
    ...p,
    minPriceCents: Math.min(...p.variations.map((v) => v.priceCents)),
  }));

  if (filters.sort === "menor-preco") {
    withMinPrice.sort((a, b) => a.minPriceCents - b.minPriceCents);
  } else if (filters.sort === "maior-preco") {
    withMinPrice.sort((a, b) => b.minPriceCents - a.minPriceCents);
  }

  return withMinPrice;
}

export async function getFilterOptions() {
  const variations = await prisma.productVariation.findMany({
    select: { size: true, color: true },
    distinct: ["size", "color"],
  });
  const products = await prisma.product.findMany({
    where: { active: true, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  });
  return {
    sizes: Array.from(new Set(variations.map((v) => v.size))).sort(),
    colors: Array.from(new Set(variations.map((v) => v.color))).sort(),
    brands: products.map((p) => p.brand).filter((b): b is string => !!b).sort(),
  };
}

export async function getPublicVariations(variationIds: string[]) {
  if (variationIds.length === 0) {
    return [];
  }
  return prisma.productVariation.findMany({
    where: {
      id: { in: variationIds },
      product: { active: true },
    },
    include: { product: true },
  });
}
