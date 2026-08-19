import { describe, it, expect } from "vitest";
import {
  addLine,
  updateLineQuantity,
  removeLine,
  totalQuantity,
  parseStoredCart,
  MAX_QUANTITY_PER_LINE,
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
