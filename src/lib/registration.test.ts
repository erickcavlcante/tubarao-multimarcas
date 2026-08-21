import { describe, it, expect } from "vitest";
import { validateRegistration } from "./registration";

const valid = {
  name: "Erick Cavalcante",
  email: "cliente@exemplo.com",
  password: "senhaforte123",
  passwordConfirm: "senhaforte123",
};

describe("validateRegistration", () => {
  it("accepts a well-formed registration", () => {
    const result = validateRegistration(valid);
    expect("data" in result).toBe(true);
  });

  it("trims the name and lowercases the email", () => {
    const result = validateRegistration({
      ...valid,
      name: "  Erick  ",
      email: "  Cliente@Exemplo.COM ",
    });
    expect("data" in result && result.data.name).toBe("Erick");
    expect("data" in result && result.data.email).toBe("cliente@exemplo.com");
  });

  it("rejects an empty name", () => {
    expect("error" in validateRegistration({ ...valid, name: "   " })).toBe(true);
  });

  it("rejects a malformed email", () => {
    for (const email of ["", "cliente", "cliente@", "@exemplo.com", "a b@c.com"]) {
      expect("error" in validateRegistration({ ...valid, email })).toBe(true);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const short = "1234567";
    expect(
      "error" in validateRegistration({ ...valid, password: short, passwordConfirm: short })
    ).toBe(true);
  });

  it("accepts a password of exactly 8 characters", () => {
    const eight = "12345678";
    expect(
      "data" in validateRegistration({ ...valid, password: eight, passwordConfirm: eight })
    ).toBe(true);
  });

  it("rejects when the confirmation does not match", () => {
    expect(
      "error" in validateRegistration({ ...valid, passwordConfirm: "outraCoisa123" })
    ).toBe(true);
  });

  it("does not trim the password", () => {
    const spaced = "  senha com espaco  ";
    const result = validateRegistration({
      ...valid,
      password: spaced,
      passwordConfirm: spaced,
    });
    expect("data" in result && result.data.password).toBe(spaced);
  });

  it("never returns the confirmation field", () => {
    const result = validateRegistration(valid);
    expect("data" in result && "passwordConfirm" in result.data).toBe(false);
  });
});
