"use client";

import { useState } from "react";
import { centsToReais, applyPixDiscount } from "@/lib/money";

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

  const pixPriceCents = applyPixDiscount(selected.priceCents, pixDiscountPercent);
  const installmentCents = Math.round(selected.priceCents / maxInstallments);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {variations.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setSelectedId(v.id)}
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
    </div>
  );
}
