"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { parsePriceToCents } from "@/lib/money";
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

  await prisma.product.update({
    where: { id },
    data: { name, slug: current.slug, description, brand, categoryId, active, images },
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
  const weightGrams = Number(formData.get("weightGrams") ?? 0);
  if (!Number.isInteger(weightGrams) || weightGrams < 1) {
    return { error: "Peso deve ser um número inteiro de gramas, maior que zero" };
  }

  if (!productId || !size || !color || !priceInput) {
    return { error: "Tamanho, cor e preço são obrigatórios" };
  }

  const priceCents = parsePriceToCents(priceInput);
  if (priceCents === null) {
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
      data: { productId, size, color, sku, priceCents, stock: Math.max(0, stock), weightGrams },
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
  const weightGrams = Number(formData.get("weightGrams") ?? 0);
  if (!Number.isInteger(weightGrams) || weightGrams < 1) {
    return { error: "Peso deve ser um número inteiro de gramas, maior que zero" };
  }

  if (!id || !priceInput) {
    return { error: "Preço é obrigatório" };
  }

  const priceCents = parsePriceToCents(priceInput);
  if (priceCents === null) {
    return { error: "Preço inválido" };
  }

  const stockBefore = Number(formData.get("stockBefore"));
  if (!Number.isInteger(stockBefore)) {
    return { error: "Não foi possível validar o estoque atual. Recarregue a página." };
  }

  // Guarda de valor esperado: o form carrega o estoque que estava na tela
  // quando a página foi renderizada. Se ele já mudou (ex: um pedido foi pago
  // entre a renderização e o salvamento), o `where` não bate em nenhuma linha
  // e a gravação é rejeitada — em vez de sobrescrever silenciosamente uma
  // baixa de estoque concorrente.
  const updated = await prisma.productVariation.updateMany({
    where: { id, stock: stockBefore },
    data: { priceCents, stock: Math.max(0, stock), weightGrams },
  });

  if (updated.count === 0) {
    return {
      error:
        "O estoque desta variação mudou enquanto você editava (provavelmente um pedido foi pago). Recarregue a página e tente de novo.",
    };
  }

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
