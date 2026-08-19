"use client";

import { useState } from "react";
import Link from "next/link";
import { centsToReais, applyPixDiscount } from "@/lib/money";
import { useCart } from "../../_components/CartProvider";

type Variation = {
  id: string;
  size: string;
  color: string;
  priceCents: number;
  stock: number;
};

export function VariationSelector({
  variations,
  pixDiscountPercent,
  maxInstallments,
}: {
  variations: Variation[];
  pixDiscountPercent: number;
  maxInstallments: number;
}) {
  const firstInStock = variations.find((v) => v.stock > 0) ?? variations[0];
  const [selectedId, setSelectedId] = useState(firstInStock.id);
  const selected = variations.find((v) => v.id === selectedId)!;

  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    addItem(selected.id, quantity);
    setAdded(true);
  }

  const pixPriceCents = applyPixDiscount(selected.priceCents, pixDiscountPercent);
  const installmentCents = Math.round(selected.priceCents / maxInstallments);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {variations.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setSelectedId(v.id);
              setAdded(false);
            }}
            disabled={v.stock === 0}
            style={{
              border: v.id === selectedId ? "2px solid black" : "1px solid #ccc",
              opacity: v.stock === 0 ? 0.4 : 1,
              padding: "4px 8px",
              background: "white",
            }}
          >
            {v.size} - {v.color}
            {v.stock === 0 ? " (esgotado)" : ""}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 24, fontWeight: "bold" }}>R$ {centsToReais(selected.priceCents)}</p>
      <p>
        ou R$ {centsToReais(pixPriceCents)} no Pix ({pixDiscountPercent}% OFF)
      </p>
      <p>
        ou {maxInstallments}x de R$ {centsToReais(installmentCents)} sem juros
      </p>
      <p>{selected.stock > 0 ? `${selected.stock} em estoque` : "Esgotado nessa variação"}</p>

      {selected.stock > 0 && (
        <div style={{ marginTop: 16 }}>
          <label>
            Quantidade:{" "}
            <input
              type="number"
              min={1}
              max={selected.stock}
              value={quantity}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const next = Number.isFinite(raw) ? Math.floor(raw) : 1;
                setQuantity(Math.min(Math.max(next, 1), selected.stock));
                setAdded(false);
              }}
              style={{ width: 60 }}
            />
          </label>
          <button
            type="button"
            onClick={handleAddToCart}
            style={{ marginLeft: 8, padding: "8px 16px" }}
          >
            Adicionar ao carrinho
          </button>
          {added && (
            <p>
              Adicionado ao carrinho. <Link href="/carrinho">Ver carrinho</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
