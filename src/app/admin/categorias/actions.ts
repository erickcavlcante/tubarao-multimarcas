"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

type CategoryActionState = { error?: string } | undefined;

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;

  const rawWeight = String(formData.get("defaultWeight") ?? "").trim();
  let defaultWeightGrams: number | null = null;
  if (rawWeight) {
    const parsed = Number(rawWeight);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: "Peso padrão deve ser um número inteiro de gramas" };
    }
    defaultWeightGrams = parsed;
  }

  if (!name) {
    return { error: "Nome é obrigatório" };
  }

  const slug = slugify(name);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Já existe uma categoria com esse nome" };
  }

  await prisma.category.create({
    data: { name, slug, parentId, defaultWeightGrams },
  });

  revalidatePath("/admin/categorias");
  return undefined;
}
