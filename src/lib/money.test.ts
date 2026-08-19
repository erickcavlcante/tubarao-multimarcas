import { describe, it, expect } from "vitest";
import { parsePriceToCents, centsToReais } from "./money";

describe("parsePriceToCents", () => {
  it("parses a simple price", () => {
    expect(parsePriceToCents("129,90")).toBe(12990);
  });

  it("parses a four-figure price with a thousands separator", () => {
    expect(parsePriceToCents("1.299,90")).toBe(129990);
  });

  it("returns null for invalid/non-numeric input", () => {
    expect(parsePriceToCents("abc")).toBeNull();
  });

  it("returns null for zero or negative price", () => {
    expect(parsePriceToCents("0")).toBeNull();
    expect(parsePriceToCents("-10,00")).toBeNull();
  });

  it("round-trips with centsToReais", () => {
    expect(centsToReais(parsePriceToCents("99,90")!)).toBe("99,90");
  });
});

describe("centsToReais", () => {
  it("formats cents as a comma-decimal string", () => {
    expect(centsToReais(12990)).toBe("129,90");
  });
});
