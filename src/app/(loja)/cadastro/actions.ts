"use server";

import { prisma } from "@/lib/prisma";
import { validateRegistration } from "@/lib/registration";
import { hashPassword } from "@/lib/password";

export type RegisterState = { error?: string; ok?: boolean } | undefined;

export async function registerCustomer(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const validated = validateRegistration({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });

  if ("error" in validated) {
    return { error: validated.error };
  }

  const existing = await prisma.user.findUnique({ where: { email: validated.data.email } });
  if (existing) {
    return { error: "Já existe uma conta com esse email" };
  }

  const passwordHash = await hashPassword(validated.data.password);

  // isAdmin NÃO é passado: fica no default `false` do schema. Nunca montar este
  // objeto espalhando dados de formulário.
  await prisma.user.create({
    data: {
      name: validated.data.name,
      email: validated.data.email,
      passwordHash,
    },
  });

  return { ok: true };
}
