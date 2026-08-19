"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "../_components/CartProvider";
import { loadCart, type LoadedCart } from "./actions";
import { centsToReais, applyPixDiscount } from "@/lib/money";

export function CartView({
  freeShippingCents,
  pixDiscountPercent,
}: {
  freeShippingCents: number;
  pixDiscountPercent: number;
}) {
  const { lines, ready, updateItem, removeItem } = useCart();
  const [cart, setCart] = useState<LoadedCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadCart(lines)
      .then((result) => {
        if (!cancelled) {
          setCart(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lines, ready]);

  if (!ready || loading) {
    return <p>Carregando carrinho...</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div>
        {cart && cart.droppedCount > 0 && (
          <p style={{ color: "#b45309" }}>
            {cart.droppedCount} item(ns) saíram do carrinho por indisponibilidade.
          </p>
        )}
        <p>Seu carrinho está vazio.</p>
        <Link href="/produtos">Ver produtos</Link>
      </div>
    );
  }

  const missingForFreeShipping = freeShippingCents - cart.subtotalCents;
  const pixSubtotalCents = applyPixDiscount(cart.subtotalCents, pixDiscountPercent);

  return (
    <div>
      {cart.droppedCount > 0 && (
        <p style={{ color: "#b45309" }}>
          {cart.droppedCount} item(ns) saíram do carrinho por indisponibilidade.
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th></th>
            <th>Produto</th>
            <th>Preço</th>
            <th>Quantidade</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cart.items.map((item) => (
            <tr key={item.variationId}>
              <td>
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.productName}
                    style={{ width: 60, height: 60, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 60, height: 60, background: "#eee" }} />
                )}
              </td>
              <td>
                <Link href={`/produto/${item.productSlug}`}>{item.productName}</Link>
                <br />
                {item.size} - {item.color}
                {item.adjusted && (
                  <p style={{ color: "#b45309" }}>
                    Quantidade ajustada: só {item.availableStock} em estoque.
                  </p>
                )}
              </td>
              <td>R$ {centsToReais(item.priceCents)}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={item.availableStock}
                  value={item.quantity}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const next = Number.isFinite(raw) ? Math.floor(raw) : 1;
                    updateItem(item.variationId, Math.min(Math.max(next, 1), item.availableStock));
                  }}
                  style={{ width: 60 }}
                />
              </td>
              <td>R$ {centsToReais(item.lineTotalCents)}</td>
              <td>
                <button type="button" onClick={() => removeItem(item.variationId)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 20, fontWeight: "bold" }}>
          Subtotal: R$ {centsToReais(cart.subtotalCents)}
        </p>
        {pixDiscountPercent > 0 && (
          <p>
            R$ {centsToReais(pixSubtotalCents)} no Pix ({pixDiscountPercent}% OFF)
          </p>
        )}
        {missingForFreeShipping > 0 ? (
          <p>Faltam R$ {centsToReais(missingForFreeShipping)} para ganhar frete grátis.</p>
        ) : (
          <p>Você ganhou frete grátis!</p>
        )}
        <p style={{ color: "#666" }}>O frete é calculado na próxima etapa.</p>
        <Link href="/checkout">
          <button type="button" style={{ padding: "12px 24px", marginTop: 8 }}>
            Finalizar compra
          </button>
        </Link>
      </div>
    </div>
  );
}
