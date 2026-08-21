import { describe, it, expect } from "vitest";
import {
  allowedTransitions,
  canTransition,
  restoresStockOnCancel,
  ORDER_STATUS_LABELS,
} from "./order-status";

describe("allowedTransitions", () => {
  it("lets an awaiting-payment order be paid or canceled", () => {
    expect(allowedTransitions("AWAITING_PAYMENT").sort()).toEqual(["CANCELED", "PAID"]);
  });

  it("lets a paid order be shipped or canceled", () => {
    expect(allowedTransitions("PAID").sort()).toEqual(["CANCELED", "SHIPPED"]);
  });

  it("lets an order with a stock issue be shipped or canceled", () => {
    expect(allowedTransitions("PAID_STOCK_ISSUE").sort()).toEqual(["CANCELED", "SHIPPED"]);
  });

  it("lets a shipped order only be marked delivered", () => {
    expect(allowedTransitions("SHIPPED")).toEqual(["DELIVERED"]);
  });

  it("treats delivered and canceled as final", () => {
    expect(allowedTransitions("DELIVERED")).toEqual([]);
    expect(allowedTransitions("CANCELED")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("accepts a permitted transition", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("rejects going backwards", () => {
    expect(canTransition("SHIPPED", "PAID")).toBe(false);
    expect(canTransition("DELIVERED", "SHIPPED")).toBe(false);
  });

  it("rejects skipping the payment step", () => {
    expect(canTransition("AWAITING_PAYMENT", "SHIPPED")).toBe(false);
  });

  it("rejects any transition out of a final status", () => {
    expect(canTransition("CANCELED", "PAID")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELED")).toBe(false);
  });

  it("rejects a transition to itself", () => {
    expect(canTransition("PAID", "PAID")).toBe(false);
  });

  it("rejects canceling something already shipped", () => {
    expect(canTransition("SHIPPED", "CANCELED")).toBe(false);
  });
});

describe("restoresStockOnCancel", () => {
  it("restores stock when canceling a paid order", () => {
    expect(restoresStockOnCancel("PAID")).toBe(true);
  });

  it("does not restore when nothing was ever decremented", () => {
    expect(restoresStockOnCancel("AWAITING_PAYMENT")).toBe(false);
  });

  it("does not auto-restore an order flagged with a stock issue", () => {
    expect(restoresStockOnCancel("PAID_STOCK_ISSUE")).toBe(false);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("has a label for every status", () => {
    for (const status of [
      "AWAITING_PAYMENT",
      "PAID",
      "PAID_STOCK_ISSUE",
      "SHIPPED",
      "DELIVERED",
      "CANCELED",
    ] as const) {
      expect(typeof ORDER_STATUS_LABELS[status]).toBe("string");
      expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
