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

  if (!name) {
    return { error: "Nome é obrigatório" };
  }

  const slug = slugify(name);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Já existe uma categoria com esse nome" };
  }

  await prisma.category.create({
    data: { name, slug, parentId },
  });

  revalidatePath("/admin/categorias");
  return undefined;
}
