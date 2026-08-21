"use client";

import { useActionState } from "react";
import { markAsPaid, type OrderActionState } from "../actions";

export function MarkAsPaidButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    markAsPaid,
    undefined
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" disabled={pending}>
          {pending ? "Processando..." : "Marcar como pago (baixa o estoque)"}
        </button>
      </form>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
      {state?.message && <p style={{ color: "#166534" }}>{state.message}</p>}
    </div>
  );
}
