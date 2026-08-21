import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const { id } = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, createdAt: true },
  });

  return (
    <div>
      <h1>Meus dados</h1>
      <p>Nome: {user?.name ?? "—"}</p>
      <p>Email: {user?.email}</p>
      <p>Cliente desde {user?.createdAt.toLocaleDateString("pt-BR")}</p>
    </div>
  );
}
