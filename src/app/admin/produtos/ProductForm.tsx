"use client";

import { useActionState } from "react";
import type { ProductActionState } from "./actions";

type Category = { id: string; name: string };

type DefaultValues = {
  id?: string;
  name: string;
  description: string;
  brand: string | null;
  categoryId: string;
  active?: boolean;
  images?: string[];
};

export function ProductForm({
  categories,
  action,
  defaultValues,
}: {
  categories: Category[];
  action: (prevState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  defaultValues?: DefaultValues;
}) {
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction}>
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <input type="text" name="name" placeholder="Nome" defaultValue={defaultValues?.name} required />
      <textarea
        name="description"
        placeholder="Descrição"
        defaultValue={defaultValues?.description}
        required
      />
      <input
        type="text"
        name="brand"
        placeholder="Marca (opcional)"
        defaultValue={defaultValues?.brand ?? ""}
      />
      <select name="categoryId" defaultValue={defaultValues?.categoryId ?? ""} required>
        <option value="" disabled>
          Selecione uma categoria
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        name="images"
        placeholder="Uma URL de imagem por linha (opcional)"
        defaultValue={defaultValues?.images?.join("\n") ?? ""}
      />
      {defaultValues?.id && (
        <label>
          <input type="checkbox" name="active" defaultChecked={defaultValues.active ?? true} />
          Ativo (visível na loja)
        </label>
      )}
      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      <button type="submit" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}
