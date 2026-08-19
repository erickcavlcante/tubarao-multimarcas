import { prisma } from "@/lib/prisma";
import { CategoryForm } from "./CategoryForm";

export default async function CategoriasPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1>Categorias</h1>
      <CategoryForm categories={categories} />
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}
            {c.parentId ? " (subcategoria)" : ""}
            {c.defaultWeightGrams ? ` — ${c.defaultWeightGrams}g` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
