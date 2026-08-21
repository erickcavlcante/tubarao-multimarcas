export type OrderStatusValue =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PAID_STOCK_ISSUE"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PAID_STOCK_ISSUE: "Pago — problema de estoque",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  AWAITING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["SHIPPED", "CANCELED"],
  PAID_STOCK_ISSUE: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};

export function allowedTransitions(from: OrderStatusValue): OrderStatusValue[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return allowedTransitions(from).includes(to);
}

export function restoresStockOnCancel(from: OrderStatusValue): boolean {
  return from === "PAID";
}
