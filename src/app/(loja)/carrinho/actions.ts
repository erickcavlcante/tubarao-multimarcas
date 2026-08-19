"use server";

import { getPublicVariations } from "@/lib/catalog";
import { MAX_QUANTITY_PER_LINE, type CartLine } from "@/lib/cart";

const MAX_LINES = 100;

export type CartItem = {
  variationId: string;
  productName: string;
  productSlug: string;
  size: string;
  color: string;
  image: string | null;
  priceCents: number;
  quantity: number;
  availableStock: number;
  lineTotalCents: number;
  adjusted: boolean;
};

export type LoadedCart = {
  items: CartItem[];
  subtotalCents: number;
  droppedCount: number;
};

export async function loadCart(lines: CartLine[]): Promise<LoadedCart> {
  const safeLines = (Array.isArray(lines) ? lines : [])
    .filter(
      (l) =>
        typeof l?.variationId === "string" &&
        typeof l?.quantity === "number" &&
        Number.isFinite(l.quantity) &&
        l.quantity > 0
    )
    .slice(0, MAX_LINES);

  const variations = await getPublicVariations(safeLines.map((l) => l.variationId));
  const byId = new Map(variations.map((v) => [v.id, v]));

  const items: CartItem[] = [];
  for (const line of safeLines) {
    const variation = byId.get(line.variationId);
    if (!variation) {
      continue;
    }
    const requested = Math.min(Math.floor(line.quantity), MAX_QUANTITY_PER_LINE);
    const quantity = Math.min(requested, variation.stock);
    if (quantity <= 0) {
      continue;
    }
    items.push({
      variationId: variation.id,
      productName: variation.product.name,
      productSlug: variation.product.slug,
      size: variation.size,
      color: variation.color,
      image: variation.image ?? variation.product.images[0] ?? null,
      priceCents: variation.priceCents,
      quantity,
      availableStock: variation.stock,
      lineTotalCents: variation.priceCents * quantity,
      adjusted: quantity !== requested,
    });
  }

  return {
    items,
    subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
    droppedCount: safeLines.length - items.length,
  };
}
