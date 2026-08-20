import { describe, it, expect } from "vitest";
import { parseAddress, isValidEmail, readShippingAddress } from "./address";

const validForm = {
  recipientName: "Erick Cavalcante",
  zipCode: "01001-000",
  street: "Praça da Sé",
  number: "100",
  complement: "apto 12",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
};

describe("parseAddress", () => {
  it("accepts a complete address and strips the zip code formatting", () => {
    const result = parseAddress(validForm);
    expect("address" in result).toBe(true);
    if ("address" in result) {
      expect(result.address.zipCode).toBe("01001000");
      expect(result.address.city).toBe("São Paulo");
    }
  });

  it("uppercases the state", () => {
    const result = parseAddress({ ...validForm, state: "sp" });
    expect("address" in result && result.address.state).toBe("SP");
  });

  it("turns an empty complement into null", () => {
    const result = parseAddress({ ...validForm, complement: "   " });
    expect("address" in result && result.address.complement).toBe(null);
  });

  it("rejects a missing required field", () => {
    for (const field of ["recipientName", "street", "number", "neighborhood", "city"]) {
      const result = parseAddress({ ...validForm, [field]: "" });
      expect("error" in result).toBe(true);
    }
  });

  it("rejects a zip code that is not 8 digits", () => {
    expect("error" in parseAddress({ ...validForm, zipCode: "0100100" })).toBe(true);
    expect("error" in parseAddress({ ...validForm, zipCode: "abc" })).toBe(true);
  });

  it("rejects a state that is not 2 letters", () => {
    expect("error" in parseAddress({ ...validForm, state: "São Paulo" })).toBe(true);
    expect("error" in parseAddress({ ...validForm, state: "S" })).toBe(true);
  });

  it("trims surrounding whitespace from every field", () => {
    const result = parseAddress({ ...validForm, city: "  São Paulo  " });
    expect("address" in result && result.address.city).toBe("São Paulo");
  });
});

describe("readShippingAddress", () => {
  const validAddress = {
    recipientName: "Erick Cavalcante",
    zipCode: "01001000",
    street: "Praça da Sé",
    number: "100",
    complement: "apto 12",
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
  };

  it("round-trips a valid address", () => {
    expect(readShippingAddress(validAddress)).toEqual(validAddress);
  });

  it("returns null for null, a string or a number", () => {
    expect(readShippingAddress(null)).toBe(null);
    expect(readShippingAddress("endereço")).toBe(null);
    expect(readShippingAddress(42)).toBe(null);
  });

  it("returns null when a required field is missing", () => {
    const fields: (keyof typeof validAddress)[] = [
      "recipientName",
      "zipCode",
      "street",
      "number",
      "neighborhood",
      "city",
      "state",
    ];
    for (const field of fields) {
      const rest: Record<string, unknown> = { ...validAddress };
      delete rest[field];
      expect(readShippingAddress(rest)).toBe(null);
    }
  });

  it("returns null when a required field is an empty string", () => {
    expect(readShippingAddress({ ...validAddress, city: "" })).toBe(null);
  });

  it("turns a missing complement into null instead of failing", () => {
    const rest: Record<string, unknown> = { ...validAddress };
    delete rest.complement;
    const result = readShippingAddress(rest);
    expect(result).not.toBe(null);
    expect(result?.complement).toBe(null);
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("cliente@exemplo.com.br")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("cliente")).toBe(false);
    expect(isValidEmail("cliente@")).toBe(false);
    expect(isValidEmail("@exemplo.com")).toBe(false);
    expect(isValidEmail("cliente exemplo@teste.com")).toBe(false);
  });
});
