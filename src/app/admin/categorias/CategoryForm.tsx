"use client";

import { useActionState } from "react";
import { createCategory } from "./actions";

type Category = { id: string; name: string };
type ActionState = { error?: string } | undefined;

export function CategoryForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCategory,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="text" name="name" placeholder="Nome da categoria" required />
      <select name="parentId" defaultValue="">
        <option value="">Sem categoria pai</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        name="defaultWeight"
        min={1}
        placeholder="Peso padrão em gramas (opcional)"
      />
      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      <button type="submit" disabled={pending}>
        Criar categoria
      </button>
    </form>
  );
}
