"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { redirect } from "next/navigation";

export type ProductActionState = { error?: string } | undefined;

function parseImages(formData: FormData): string[] {
  const raw = String(formData.get("images") ?? "");
  return raw
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "");
  const images = parseImages(formData);

  if (!name || !description || !categoryId) {
    return { error: "Nome, descrição e categoria são obrigatórios" };
  }

  const slug = slugify(name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Já existe um produto com esse nome" };
  }

  const product = await prisma.product.create({
    data: { name, slug, description, brand, categoryId, images },
  });

  redirect(`/admin/produtos/${product.id}`);
}
