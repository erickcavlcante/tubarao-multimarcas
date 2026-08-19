import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugify("Camiseta Azul")).toBe("camiseta-azul");
  });

  it("removes accents", () => {
    expect(slugify("Calça Jeans Elastano")).toBe("calca-jeans-elastano");
  });

  it("collapses multiple spaces and trims", () => {
    expect(slugify("  Bermuda   Cargo  ")).toBe("bermuda-cargo");
  });

  it("strips characters that aren't letters, numbers, or spaces", () => {
    expect(slugify("Kit Camisa + Bermuda (Promo!)")).toBe("kit-camisa-bermuda-promo");
  });
});
