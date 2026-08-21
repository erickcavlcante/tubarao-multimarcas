import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null } | undefined;

  const savedAddresses = user?.id
    ? await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <h1>Finalizar compra</h1>
      <CheckoutForm savedAddresses={savedAddresses} defaultEmail={user?.email ?? null} />
    </div>
  );
}
