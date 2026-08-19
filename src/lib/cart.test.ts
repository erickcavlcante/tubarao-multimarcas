import { describe, it, expect } from "vitest";
import {
  addLine,
  updateLineQuantity,
  removeLine,
  totalQuantity,
  parseStoredCart,
  aggregateRequestedQuantities,
  resolveQuantity,
  MAX_QUANTITY_PER_LINE,
  MAX_CART_LINES,
  type CartLine,
} from "./cart";

describe("addLine", () => {
  it("adds a new line to an empty cart", () => {
    expect(addLine([], "v1", 2)).toEqual([{ variationId: "v1", quantity: 2 }]);
  });

  it("sums the quantity when the variation is already in the cart", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: 2 }];
    expect(addLine(lines, "v1", 3)).toEqual([{ variationId: "v1", quantity: 5 }]);
  });

  it("keeps other lines untouched when adding", () => {
    const lines: CartLine[] = [
      { variationId: "v1", quantity: 1 },
      { variationId: "v2", quantity: 4 },
    ];
    expect(addLine(lines, "v1", 1)).toEqual([
      { variationId: "v1", quantity: 2 },
      { variationId: "v2", quantity: 4 },
    ]);
  });

  it("ignores a non-positive quantity", () => {
    expect(addLine([], "v1", 0)).toEqual([]);
    expect(addLine([], "v1", -3)).toEqual([]);
  });

  it("caps the quantity at MAX_QUANTITY_PER_LINE", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: MAX_QUANTITY_PER_LINE }];
    expect(addLine(lines, "v1", 10)).toEqual([
      { variationId: "v1", quantity: MAX_QUANTITY_PER_LINE },
    ]);
  });

  it("does not mutate the input array", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: 1 }];
    addLine(lines, "v1", 1);
    expect(lines).toEqual([{ variationId: "v1", quantity: 1 }]);
  });
});

describe("updateLineQuantity", () => {
  it("sets a new quantity", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: 2 }];
    expect(updateLineQuantity(lines, "v1", 7)).toEqual([{ variationId: "v1", quantity: 7 }]);
  });

  it("removes the line when the quantity drops to zero or below", () => {
    const lines: CartLine[] = [
      { variationId: "v1", quantity: 2 },
      { variationId: "v2", quantity: 1 },
    ];
    expect(updateLineQuantity(lines, "v1", 0)).toEqual([{ variationId: "v2", quantity: 1 }]);
    expect(updateLineQuantity(lines, "v1", -5)).toEqual([{ variationId: "v2", quantity: 1 }]);
  });

  it("caps at MAX_QUANTITY_PER_LINE", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: 1 }];
    expect(updateLineQuantity(lines, "v1", MAX_QUANTITY_PER_LINE + 50)).toEqual([
      { variationId: "v1", quantity: MAX_QUANTITY_PER_LINE },
    ]);
  });
});

describe("removeLine", () => {
  it("removes only the matching variation", () => {
    const lines: CartLine[] = [
      { variationId: "v1", quantity: 2 },
      { variationId: "v2", quantity: 1 },
    ];
    expect(removeLine(lines, "v1")).toEqual([{ variationId: "v2", quantity: 1 }]);
  });

  it("is a no-op when the variation is not in the cart", () => {
    const lines: CartLine[] = [{ variationId: "v1", quantity: 2 }];
    expect(removeLine(lines, "v9")).toEqual(lines);
  });
});

describe("totalQuantity", () => {
  it("returns zero for an empty cart", () => {
    expect(totalQuantity([])).toBe(0);
  });

  it("sums quantities across lines", () => {
    expect(
      totalQuantity([
        { variationId: "v1", quantity: 2 },
        { variationId: "v2", quantity: 3 },
      ])
    ).toBe(5);
  });
});

describe("parseStoredCart", () => {
  it("returns an empty array for anything that is not an array", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("lixo")).toEqual([]);
    expect(parseStoredCart({ variationId: "v1" })).toEqual([]);
  });

  it("keeps only well-formed lines", () => {
    const raw = [
      { variationId: "v1", quantity: 2 },
      { variationId: "v2" },
      { quantity: 3 },
      { variationId: 5, quantity: 3 },
      { variationId: "v3", quantity: "muitos" },
      { variationId: "v4", quantity: 1 },
    ];
    expect(parseStoredCart(raw)).toEqual([
      { variationId: "v1", quantity: 2 },
      { variationId: "v4", quantity: 1 },
    ]);
  });

  it("drops lines with a non-positive quantity", () => {
    expect(parseStoredCart([{ variationId: "v1", quantity: 0 }])).toEqual([]);
    expect(parseStoredCart([{ variationId: "v1", quantity: -2 }])).toEqual([]);
  });
});

describe("aggregateRequestedQuantities", () => {
  it("sums duplicate lines for the same variationId into one entry", () => {
    const lines: CartLine[] = [
      { variationId: "v1", quantity: 2 },
      { variationId: "v1", quantity: 3 },
    ];
    expect(aggregateRequestedQuantities(lines)).toEqual(new Map([["v1", 5]]));
  });

  it("returns an empty Map for non-array input", () => {
    expect(aggregateRequestedQuantities(null)).toEqual(new Map());
    expect(aggregateRequestedQuantities("lixo")).toEqual(new Map());
    expect(aggregateRequestedQuantities({ variationId: "v1", quantity: 2 })).toEqual(new Map());
  });

  it("drops malformed entries with missing or wrong-typed fields", () => {
    const raw = [
      { variationId: "v1", quantity: 2 },
      { variationId: "v2" },
      { quantity: 3 },
      { variationId: 5, quantity: 3 },
      { variationId: "v3", quantity: "muitos" },
    ];
    expect(aggregateRequestedQuantities(raw)).toEqual(new Map([["v1", 2]]));
  });

  it("drops NaN, Infinity, zero, and negative quantities", () => {
    const raw = [
      { variationId: "v1", quantity: Number.NaN },
      { variationId: "v2", quantity: Number.POSITIVE_INFINITY },
      { variationId: "v3", quantity: 0 },
      { variationId: "v4", quantity: -5 },
      { variationId: "v5", quantity: 4 },
    ];
    expect(aggregateRequestedQuantities(raw)).toEqual(new Map([["v5", 4]]));
  });

  it("floors fractional quantities", () => {
    expect(aggregateRequestedQuantities([{ variationId: "v1", quantity: 2.9 }])).toEqual(
      new Map([["v1", 2]])
    );
  });

  it("truncates input longer than MAX_CART_LINES", () => {
    const raw: CartLine[] = Array.from({ length: MAX_CART_LINES + 10 }, (_, i) => ({
      variationId: `v${i}`,
      quantity: 1,
    }));
    expect(aggregateRequestedQuantities(raw).size).toBe(MAX_CART_LINES);
  });
});

describe("resolveQuantity", () => {
  it("passes a quantity within stock through with adjusted: false", () => {
    expect(resolveQuantity(3, 10)).toEqual({ quantity: 3, adjusted: false });
  });

  it("clamps a quantity above stock down with adjusted: true", () => {
    expect(resolveQuantity(8, 3)).toEqual({ quantity: 3, adjusted: true });
  });

  it("caps a quantity above MAX_QUANTITY_PER_LINE", () => {
    // Stock is not the limiting factor here, so the cap itself does not
    // count as a stock-driven adjustment.
    expect(resolveQuantity(MAX_QUANTITY_PER_LINE + 50, 1000)).toEqual({
      quantity: MAX_QUANTITY_PER_LINE,
      adjusted: false,
    });
  });

  it("returns null (drop) for zero stock", () => {
    expect(resolveQuantity(5, 0)).toBeNull();
  });

  it("bounds a huge/Infinity raw quantity by min(MAX_QUANTITY_PER_LINE, stock)", () => {
    expect(resolveQuantity(Number.POSITIVE_INFINITY, 10)).toEqual({
      quantity: 10,
      adjusted: true,
    });
    expect(resolveQuantity(Number.POSITIVE_INFINITY, 1000)).toEqual({
      quantity: MAX_QUANTITY_PER_LINE,
      adjusted: false,
    });
  });
});
