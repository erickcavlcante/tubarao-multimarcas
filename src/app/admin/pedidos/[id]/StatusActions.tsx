"use client";

import { useActionState } from "react";
import { changeStatus, type OrderActionState } from "../actions";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

export function StatusActions({
  orderId,
  targets,
}: {
  orderId: string;
  targets: OrderStatusValue[];
}) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    changeStatus,
    undefined
  );

  if (targets.length === 0) {
    return <p>Este pedido está finalizado — nenhuma ação disponível.</p>;
  }

  return (
    <div>
      {targets.map((target) => (
        <form key={target} action={formAction} style={{ display: "inline" }}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={target} />
          <button type="submit" disabled={pending} style={{ marginRight: 8 }}>
            Marcar como {ORDER_STATUS_LABELS[target].toLowerCase()}
          </button>
        </form>
      ))}
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
      {state?.message && <p style={{ color: "#166534" }}>{state.message}</p>}
    </div>
  );
}
