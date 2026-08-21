import { auth } from "@/lib/auth";

export async function requireUser(): Promise<{ id: string; isAdmin: boolean }> {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;

  if (!user?.id) {
    throw new Error("Não autorizado");
  }

  return { id: user.id, isAdmin: user.isAdmin ?? false };
}
