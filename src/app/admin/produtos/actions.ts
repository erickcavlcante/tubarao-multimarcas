"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";

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
  await requireAdmin();

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

export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "");
  const active = formData.get("active") === "on";
  const images = parseImages(formData);

  if (!id || !name || !description || !categoryId) {
    return { error: "Nome, descrição e categoria são obrigatórios" };
  }

  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) {
    return { error: "Produto não encontrado" };
  }

  let slug = current.slug;
  if (name !== current.name) {
    const newSlug = slugify(name);
    const collision = await prisma.product.findFirst({ where: { slug: newSlug, NOT: { id } } });
    if (collision) {
      return { error: "Já existe outro produto com esse nome" };
    }
    slug = newSlug;
  }

  await prisma.product.update({
    where: { id },
    data: { name, slug, description, brand, categoryId, active, images },
  });

  revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/admin/produtos");
  return undefined;
}

export async function createVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const size = String(formData.get("size") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const priceInput = String(formData.get("price") ?? "").trim();
  const stock = Number(formData.get("stock") ?? 0);

  if (!productId || !size || !color || !priceInput) {
    return { error: "Tamanho, cor e preço são obrigatórios" };
  }

  const priceCents = Math.round(Number(priceInput.replace(",", ".")) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Preço inválido" };
  }

  const existing = await prisma.productVariation.findUnique({
    where: { productId_size_color: { productId, size, color } },
  });
  if (existing) {
    return { error: "Já existe uma variação com esse tamanho e cor" };
  }

  const sku = `${productId.slice(0, 8)}-${size}-${color}`.toUpperCase().replace(/\s+/g, "");

  try {
    await prisma.productVariation.create({
      data: { productId, size, color, sku, priceCents, stock: Math.max(0, stock) },
    });
  } catch {
    return { error: "Não foi possível criar a variação (SKU duplicado?)" };
  }

  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}

export async function updateVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const priceInput = String(formData.get("price") ?? "").trim();
  const stock = Number(formData.get("stock") ?? 0);

  if (!id || !priceInput) {
    return { error: "Preço é obrigatório" };
  }

  const priceCents = Math.round(Number(priceInput.replace(",", ".")) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Preço inválido" };
  }

  await prisma.productVariation.update({
    where: { id },
    data: { priceCents, stock: Math.max(0, stock) },
  });

  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}

export async function deleteVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const orderItemCount = await prisma.orderItem.count({ where: { variationId: id } });
  if (orderItemCount > 0) {
    return { error: "Não é possível excluir: essa variação já tem pedidos associados" };
  }

  await prisma.productVariation.delete({ where: { id } });
  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}
