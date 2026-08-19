"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  addLine,
  updateLineQuantity,
  removeLine,
  totalQuantity,
  parseStoredCart,
  type CartLine,
} from "@/lib/cart";

const STORAGE_KEY = "loja-carrinho";

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  addItem: (variationId: string, quantity: number) => void;
  updateItem: (variationId: string, quantity: number) => void;
  removeItem: (variationId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // One-time sync from localStorage on mount (client-only external system);
        // this must stay in an effect (not a lazy useState initializer) so the
        // server-rendered empty cart matches the first client render and only
        // updates afterward — that's what avoids a hydration mismatch here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLines(parseStoredCart(JSON.parse(raw)));
      }
    } catch {
      // localStorage indisponível ou conteúdo inválido — começa vazio
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // modo privado ou sem espaço — o carrinho continua funcionando na sessão
    }
  }, [lines, ready]);

  const value: CartContextValue = {
    lines,
    ready,
    count: totalQuantity(lines),
    addItem: (variationId, quantity) => setLines((prev) => addLine(prev, variationId, quantity)),
    updateItem: (variationId, quantity) =>
      setLines((prev) => updateLineQuantity(prev, variationId, quantity)),
    removeItem: (variationId) => setLines((prev) => removeLine(prev, variationId)),
    clear: () => setLines([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart precisa ser usado dentro de um CartProvider");
  }
  return ctx;
}
