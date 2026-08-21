import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { AddressManager } from "./AddressManager";

export const dynamic = "force-dynamic";

export default async function EnderecosPage() {
  const { id: userId } = await requireUser();

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Meus endereços</h1>
      <AddressManager addresses={addresses} />
    </div>
  );
}
