"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parsePriceToCents } from "@/lib/money";
import { revalidatePath } from "next/cache";

export type SettingsActionState = { error?: string; ok?: boolean } | undefined;

function parsePositiveInt(value: FormDataEntryValue | null, min: number): number | null {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    return null;
  }
  return parsed;
}

export async function updateSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  await requireAdmin();

  const freeShippingCents = parsePriceToCents(String(formData.get("freeShipping") ?? ""));
  if (freeShippingCents === null) {
    return { error: "Valor de frete grátis inválido" };
  }

  const pixDiscountPercent = parsePositiveInt(formData.get("pixDiscount"), 0);
  if (pixDiscountPercent === null || pixDiscountPercent > 100) {
    return { error: "Desconto do Pix deve ser um número entre 0 e 100" };
  }

  const maxInstallments = parsePositiveInt(formData.get("maxInstallments"), 1);
  if (maxInstallments === null || maxInstallments > 24) {
    return { error: "Parcelas deve ser um número entre 1 e 24" };
  }

  const packageWidthCm = parsePositiveInt(formData.get("packageWidth"), 1);
  const packageHeightCm = parsePositiveInt(formData.get("packageHeight"), 1);
  const packageLengthCm = parsePositiveInt(formData.get("packageLength"), 1);
  if (packageWidthCm === null || packageHeightCm === null || packageLengthCm === null) {
    return { error: "Dimensões da embalagem devem ser números inteiros em centímetros" };
  }

  const defaultWeightGrams = parsePositiveInt(formData.get("defaultWeight"), 1);
  if (defaultWeightGrams === null) {
    return { error: "Peso padrão deve ser um número inteiro em gramas" };
  }

  const rawZip = String(formData.get("originZipCode") ?? "").replace(/\D/g, "");
  if (rawZip.length !== 8) {
    return { error: "CEP de origem deve ter 8 dígitos" };
  }

  await prisma.storeSettings.update({
    where: { id: 1 },
    data: {
      freeShippingCents,
      pixDiscountPercent,
      maxInstallments,
      packageWidthCm,
      packageHeightCm,
      packageLengthCm,
      defaultWeightGrams,
      originZipCode: rawZip,
    },
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/");
  revalidatePath("/carrinho");
  return { ok: true };
}
