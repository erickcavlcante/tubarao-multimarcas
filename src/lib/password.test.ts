import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("senha-correta-123");
    expect(await verifyPassword("senha-correta-123", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("senha-correta-123");
    expect(await verifyPassword("senha-errada", hash)).toBe(false);
  });

  it("never stores the password in plain text", async () => {
    const hash = await hashPassword("senha-correta-123");
    expect(hash).not.toBe("senha-correta-123");
  });
});
