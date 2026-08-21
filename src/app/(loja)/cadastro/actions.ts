"use server";

import { Prisma } from "@prisma/client";
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

  try {
    // isAdmin NÃO é passado: fica no default `false` do schema. Nunca montar
    // este objeto espalhando dados de formulário.
    await prisma.user.create({
      data: {
        name: validated.data.name,
        email: validated.data.email,
        passwordHash,
      },
    });
  } catch (error) {
    // A constraint única do banco é a garantia real; a checagem acima é só
    // para dar uma mensagem melhor no caso comum. Cobre o caso de duas
    // submissões concorrentes para o mesmo email passarem pelo findUnique.
    // Qualquer outra falha (banco fora do ar, pool esgotado, bcrypt etc.)
    // precisa aparecer nos logs em vez de virar silenciosamente "email
    // duplicado" — senão uma indisponibilidade real passa despercebida.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe uma conta com esse email" };
    }
    console.error("Falha ao criar conta:", error);
    return { error: "Não foi possível criar sua conta agora. Tente novamente." };
  }

  return { ok: true };
}
