export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    return null;
  }
  return cents;
}

export function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
