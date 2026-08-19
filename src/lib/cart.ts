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

export const MAX_CART_LINES = 100;

export function aggregateRequestedQuantities(lines: unknown): Map<string, number> {
  const safeLines = (Array.isArray(lines) ? lines : [])
    .filter(
      (l) =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as CartLine).variationId === "string" &&
        typeof (l as CartLine).quantity === "number" &&
        Number.isFinite((l as CartLine).quantity) &&
        (l as CartLine).quantity > 0
    )
    .slice(0, MAX_CART_LINES) as CartLine[];

  const requested = new Map<string, number>();
  for (const line of safeLines) {
    const previous = requested.get(line.variationId) ?? 0;
    requested.set(line.variationId, previous + Math.floor(line.quantity));
  }
  return requested;
}

export function resolveQuantity(
  rawQuantity: number,
  stock: number
): { quantity: number; adjusted: boolean } | null {
  const requested = Math.min(rawQuantity, MAX_QUANTITY_PER_LINE);
  const quantity = Math.min(requested, stock);
  if (quantity <= 0) {
    return null;
  }
  return { quantity, adjusted: quantity !== requested };
}
