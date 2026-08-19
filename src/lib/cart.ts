export type CartLine = { variationId: string; quantity: number };

export const MAX_QUANTITY_PER_LINE = 99;

function cap(quantity: number): number {
  return Math.min(quantity, MAX_QUANTITY_PER_LINE);
}

export function addLine(lines: CartLine[], variationId: string, quantity: number): CartLine[] {
  if (quantity <= 0) {
    return lines;
  }
  const existing = lines.find((l) => l.variationId === variationId);
  if (!existing) {
    return [...lines, { variationId, quantity: cap(quantity) }];
  }
  return lines.map((l) =>
    l.variationId === variationId ? { ...l, quantity: cap(l.quantity + quantity) } : l
  );
}

export function updateLineQuantity(
  lines: CartLine[],
  variationId: string,
  quantity: number
): CartLine[] {
  if (quantity <= 0) {
    return removeLine(lines, variationId);
  }
  return lines.map((l) =>
    l.variationId === variationId ? { ...l, quantity: cap(quantity) } : l
  );
}

export function removeLine(lines: CartLine[], variationId: string): CartLine[] {
  return lines.filter((l) => l.variationId !== variationId);
}

export function totalQuantity(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function parseStoredCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (l): l is CartLine =>
      typeof l === "object" &&
      l !== null &&
      typeof (l as CartLine).variationId === "string" &&
      typeof (l as CartLine).quantity === "number" &&
      Number.isFinite((l as CartLine).quantity) &&
      (l as CartLine).quantity > 0
  );
}
