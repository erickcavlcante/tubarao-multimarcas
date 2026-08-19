import { prisma } from "@/lib/prisma";
import { CartView } from "./CartView";

export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });

  return (
    <div>
      <h1>Carrinho</h1>
      <CartView
        freeShippingCents={settings?.freeShippingCents ?? Number.POSITIVE_INFINITY}
        pixDiscountPercent={settings?.pixDiscountPercent ?? 0}
      />
    </div>
  );
}
