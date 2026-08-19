"use server";

import { getPublicVariations } from "@/lib/catalog";
import {
  aggregateRequestedQuantities,
  resolveQuantity,
  type CartLine,
} from "@/lib/cart";

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
  const requestedByVariation = aggregateRequestedQuantities(lines);
  const variations = await getPublicVariations([...requestedByVariation.keys()]);
  const byId = new Map(variations.map((v) => [v.id, v]));

  const items: CartItem[] = [];
  for (const [variationId, rawQuantity] of requestedByVariation) {
    const variation = byId.get(variationId);
    if (!variation) {
      continue;
    }
    const resolved = resolveQuantity(rawQuantity, variation.stock);
    if (!resolved) {
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
      quantity: resolved.quantity,
      availableStock: variation.stock,
      lineTotalCents: variation.priceCents * resolved.quantity,
      adjusted: resolved.adjusted,
    });
  }

  return {
    items,
    subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
    droppedCount: requestedByVariation.size - items.length,
  };
}
