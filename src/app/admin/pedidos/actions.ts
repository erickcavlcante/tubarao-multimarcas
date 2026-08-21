"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";

export type OrderActionState = { error?: string; message?: string } | undefined;

export async function markAsPaid(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) {
    return { error: "Pedido não informado" };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Compare-and-swap: só uma chamada consegue tirar o pedido de
    // AWAITING_PAYMENT. Ler o status e depois gravar seria corrida — dois
    // cliques simultâneos leriam "aguardando" e ambos baixariam estoque.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "AWAITING_PAYMENT" },
      data: { status: "PAID" },
    });

    if (claimed.count === 0) {
      return { error: "Este pedido não está mais aguardando pagamento" };
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });

    const shortages: string[] = [];
    for (const item of items) {
      // Baixa condicional: o `where` com `stock: { gte: quantity }` garante
      // que a linha só é atualizada se houver estoque suficiente. Um
      // decrement sem essa condição gravaria estoque negativo.
      const decremented = await tx.productVariation.updateMany({
        where: { id: item.variationId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (decremented.count === 0) {
        const variation = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          include: { product: true },
        });
        shortages.push(
          variation
            ? `${variation.product.name} (${variation.size} - ${variation.color}): pedido ${item.quantity}, em estoque ${variation.stock}`
            : `variação ${item.variationId} não encontrada`
        );
      }
    }

    if (shortages.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID_STOCK_ISSUE" },
      });
      return {
        message: `Pedido marcado como pago, mas faltou estoque: ${shortages.join("; ")}. Ajuste o estoque e trate o pedido manualmente.`,
      };
    }

    return { message: "Pedido marcado como pago e estoque baixado." };
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return result;
}
