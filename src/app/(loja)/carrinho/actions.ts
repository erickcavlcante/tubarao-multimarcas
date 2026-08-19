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

  // Soma linhas repetidas da mesma variação ANTES de limitar pelo estoque.
  // Sem isso, N linhas do mesmo item passariam cada uma pelo teto do estoque
  // cheio, e o carrinho poderia representar N x o estoque real.
  const requestedByVariation = new Map<string, number>();
  for (const line of safeLines) {
    const previous = requestedByVariation.get(line.variationId) ?? 0;
    requestedByVariation.set(line.variationId, previous + Math.floor(line.quantity));
  }

  const variations = await getPublicVariations([...requestedByVariation.keys()]);
  const byId = new Map(variations.map((v) => [v.id, v]));

  const items: CartItem[] = [];
  for (const [variationId, rawQuantity] of requestedByVariation) {
    const variation = byId.get(variationId);
    if (!variation) {
      continue;
    }
    const requested = Math.min(rawQuantity, MAX_QUANTITY_PER_LINE);
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
    droppedCount: requestedByVariation.size - items.length,
  };
}
