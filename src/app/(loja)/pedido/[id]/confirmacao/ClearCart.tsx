"use client";

import { useEffect } from "react";
import { useCart } from "../../../_components/CartProvider";

const CLEARED_ORDERS_KEY = "loja-pedidos-limpos";

export function ClearCart({ orderId }: { orderId: string }) {
  const { clear, ready } = useCart();

  useEffect(() => {
    if (!ready) {
      return;
    }
    let alreadyCleared: string[] = [];
    try {
      const raw = window.localStorage.getItem(CLEARED_ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      alreadyCleared = Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      alreadyCleared = [];
    }

    if (alreadyCleared.includes(orderId)) {
      return;
    }

    // Limpar o carrinho é uma sincronização com um evento externo (o pedido foi
    // criado no servidor), não um cálculo de render — um efeito é o único lugar
    // possível. A lista de pedidos já limpos garante idempotência: recarregar
    // esta página não mexe num carrinho novo que o cliente tenha montado depois.
    // (react-hooks/set-state-in-effect não dispara aqui porque `clear` vem de
    // useCart(), não de um useState direto neste componente — sem disable a fazer.)
    clear();

    try {
      window.localStorage.setItem(
        CLEARED_ORDERS_KEY,
        JSON.stringify([...alreadyCleared.slice(-19), orderId])
      );
    } catch {
      // localStorage cheio ou indisponível — o carrinho já foi limpo, segue
    }
  }, [orderId, ready, clear]);

  return null;
}
