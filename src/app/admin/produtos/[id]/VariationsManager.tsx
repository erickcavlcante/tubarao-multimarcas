"use client";

import { useActionState } from "react";
import { createVariation, updateVariation, deleteVariation } from "../actions";
import type { ProductActionState } from "../actions";
import { centsToReais } from "@/lib/money";

type Variation = {
  id: string;
  size: string;
  color: string;
  sku: string;
  priceCents: number;
  stock: number;
  weightGrams: number;
};

function VariationRow({
  variation,
  productId,
  suggestedWeightGrams,
}: {
  variation: Variation;
  productId: string;
  suggestedWeightGrams: number;
}) {
  // suggestedWeightGrams is only used by the "add variation" form below;
  // this row edits the variation's existing weight, not the suggestion.
  void suggestedWeightGrams;
  const [updateState, updateActionBound, updatePending] = useActionState<
    ProductActionState,
    FormData
  >(updateVariation, undefined);
  const [deleteState, deleteActionBound, deletePending] = useActionState<
    ProductActionState,
    FormData
  >(deleteVariation, undefined);

  return (
    <tr>
      <td>{variation.size}</td>
      <td>{variation.color}</td>
      <td>{variation.sku}</td>
      <td>
        <form action={updateActionBound} style={{ display: "inline-flex", gap: 4 }}>
          <input type="hidden" name="id" value={variation.id} />
          <input type="hidden" name="productId" value={productId} />
          <input type="text" name="price" defaultValue={centsToReais(variation.priceCents)} size={6} />
          <input type="number" name="stock" defaultValue={variation.stock} min={0} size={4} />
          <input type="number" name="weightGrams" defaultValue={variation.weightGrams} min={1} size={5} />
          <button type="submit" disabled={updatePending}>
            Salvar
          </button>
        </form>
        {updateState?.error && <p style={{ color: "red" }}>{updateState.error}</p>}
      </td>
      <td>
        <form action={deleteActionBound}>
          <input type="hidden" name="id" value={variation.id} />
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" disabled={deletePending}>
            Excluir
          </button>
        </form>
        {deleteState?.error && <p style={{ color: "red" }}>{deleteState.error}</p>}
      </td>
    </tr>
  );
}

export function VariationsManager({
  variations,
  productId,
  suggestedWeightGrams,
}: {
  variations: Variation[];
  productId: string;
  suggestedWeightGrams: number;
}) {
  const [createState, createActionBound, createPending] = useActionState<
    ProductActionState,
    FormData
  >(createVariation, undefined);

  return (
    <div>
      <h2>Variações (tamanho / cor / estoque)</h2>
      <table>
        <thead>
          <tr>
            <th>Tamanho</th>
            <th>Cor</th>
            <th>SKU</th>
            <th>Preço (R$) / Estoque / Peso (g)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {variations.map((v) => (
            <VariationRow
              key={v.id}
              variation={v}
              productId={productId}
              suggestedWeightGrams={suggestedWeightGrams}
            />
          ))}
        </tbody>
      </table>

      <h3>Adicionar variação</h3>
      <form action={createActionBound}>
        <input type="hidden" name="productId" value={productId} />
        <input type="text" name="size" placeholder="Tamanho (ex: M)" required />
        <input type="text" name="color" placeholder="Cor (ex: Azul)" required />
        <input type="text" name="price" placeholder="Preço (ex: 129,90)" required />
        <input type="number" name="stock" placeholder="Estoque" min={0} defaultValue={0} />
        <input
          type="number"
          name="weightGrams"
          placeholder="Peso (g)"
          min={1}
          defaultValue={suggestedWeightGrams}
          required
        />
        <button type="submit" disabled={createPending}>
          Adicionar
        </button>
      </form>
      {createState?.error && <p style={{ color: "red" }}>{createState.error}</p>}
    </div>
  );
}
