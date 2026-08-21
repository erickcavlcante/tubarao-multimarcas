"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";
import { canTransition, type OrderStatusValue } from "@/lib/order-status";

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

  let result: OrderActionState;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Compare-and-swap: só uma chamada consegue tirar o pedido de
      // AWAITING_PAYMENT. Ler o status e depois gravar seria corrida — dois
      // cliques simultâneos leriam "aguardando" e ambos baixariam estoque.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "AWAITING_PAYMENT" },
        data: { status: "PAID", paymentMethod: "manual" },
      });

      if (claimed.count === 0) {
        return { error: "Este pedido não está mais aguardando pagamento" };
      }

      // orderBy garante que toda transação bloqueia as variações na mesma
      // ordem global — sem isso, dois pedidos que compartilham variações em
      // ordem oposta podem travar as linhas em ordem oposta e causar
      // deadlock (Postgres mata uma das transações com 40P01).
      const items = await tx.orderItem.findMany({
        where: { orderId },
        orderBy: { variationId: "asc" },
      });

      const shortages: string[] = [];
      for (const item of items) {
        // Baixa condicional: o `where` com `stock: { gte: quantity }` garante
        // que a linha só é atualizada se houver estoque suficiente. Um
        // decrement sem essa condição gravaria estoque negativo.
        const decremented = await tx.productVariation.updateMany({
          where: { id: item.variationId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (decremented.count === 1) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { stockDecremented: true },
          });
        } else {
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
  } catch {
    return { error: "Não foi possível concluir a operação. Nada foi alterado — tente novamente." };
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return result;
}

export async function changeStatus(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const target = String(formData.get("status") ?? "") as OrderStatusValue;
  if (!orderId || !target) {
    return { error: "Dados incompletos" };
  }

  let result: OrderActionState;
  try {
    result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return { error: "Pedido não encontrado" };
      }

      const current = order.status as OrderStatusValue;
      if (!canTransition(current, target)) {
        return { error: "Essa mudança de status não é permitida" };
      }

      // Mesmo compare-and-swap do markAsPaid: garante que a transição só
      // acontece a partir do status que acabamos de validar.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: current },
        data: { status: target },
      });

      if (claimed.count === 0) {
        return { error: "O pedido mudou de status enquanto você agia. Recarregue a página." };
      }

      if (target === "CANCELED") {
        // Devolve exatamente os itens que saíram do estoque, lidos do campo que
        // markAsPaid gravou. `orderBy` mantém a mesma ordem global de lock usada
        // na baixa, evitando deadlock entre dois cancelamentos simultâneos.
        const decrementedItems = await tx.orderItem.findMany({
          where: { orderId, stockDecremented: true },
          orderBy: { variationId: "asc" },
        });

        for (const item of decrementedItems) {
          await tx.productVariation.update({
            where: { id: item.variationId },
            data: { stock: { increment: item.quantity } },
          });
        }

        if (decrementedItems.length > 0) {
          await tx.orderItem.updateMany({
            where: { orderId, stockDecremented: true },
            data: { stockDecremented: false },
          });
          return {
            message: `Pedido cancelado. ${decrementedItems.length} item(ns) devolvido(s) ao estoque.`,
          };
        }

        return { message: "Pedido cancelado. Nenhum item havia saído do estoque." };
      }

      return { message: "Status atualizado." };
    });
  } catch {
    return { error: "Não foi possível concluir a operação. Nada foi alterado — tente novamente." };
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return result;
}
