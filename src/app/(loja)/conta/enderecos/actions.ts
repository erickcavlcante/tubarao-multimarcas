"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { parseAddress } from "@/lib/address";
import { revalidatePath } from "next/cache";

export type AddressState = { error?: string; ok?: boolean } | undefined;

export async function addAddress(
  _prevState: AddressState,
  formData: FormData
): Promise<AddressState> {
  const { id: userId } = await requireUser();

  const parsed = parseAddress({
    recipientName: String(formData.get("recipientName") ?? ""),
    zipCode: String(formData.get("zipCode") ?? ""),
    street: String(formData.get("street") ?? ""),
    number: String(formData.get("number") ?? ""),
    complement: String(formData.get("complement") ?? ""),
    neighborhood: String(formData.get("neighborhood") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
  });

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const label = String(formData.get("label") ?? "").trim() || null;

  await prisma.address.create({
    // userId vem da sessão, nunca do formulário.
    data: { ...parsed.address, label, userId },
  });

  revalidatePath("/conta/enderecos");
  return { ok: true };
}

export async function deleteAddress(
  _prevState: AddressState,
  formData: FormData
): Promise<AddressState> {
  const { id: userId } = await requireUser();

  const addressId = String(formData.get("addressId") ?? "");
  if (!addressId) {
    return { error: "Endereço não informado" };
  }

  // O filtro por userId é o que impede um cliente de apagar o endereço de outro.
  const deleted = await prisma.address.deleteMany({
    where: { id: addressId, userId },
  });

  if (deleted.count === 0) {
    return { error: "Endereço não encontrado" };
  }

  revalidatePath("/conta/enderecos");
  return { ok: true };
}
