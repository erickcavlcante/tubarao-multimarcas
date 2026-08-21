"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { loadCart } from "../carrinho/actions";
import { parseAddress, isValidEmail } from "@/lib/address";
import type { CartLine } from "@/lib/cart";

export type PlaceOrderState = { error?: string } | undefined;

export async function placeOrder(
  _prevState: PlaceOrderState,
  formData: FormData
): Promise<PlaceOrderState> {
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  if (!isValidEmail(contactEmail)) {
    return { error: "Email inválido" };
  }

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

  let lines: CartLine[];
  try {
    const raw = JSON.parse(String(formData.get("lines") ?? "[]"));
    lines = Array.isArray(raw) ? raw : [];
  } catch {
    return { error: "Carrinho inválido" };
  }

  // Vem da sessão, nunca do formulário — um userId enviado pelo cliente
  // deixaria qualquer um atribuir pedidos à conta de outra pessoa.
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  let order;
  try {
    // O carrinho é relido inteiro do banco: preços, estoque e disponibilidade
    // vêm daqui, nunca do que o navegador mandou.
    const cart = await loadCart(lines);
    if (cart.items.length === 0) {
      return { error: "Seu carrinho está vazio ou os itens não estão mais disponíveis" };
    }

    // Se o estoque mudou entre o carrinho que o cliente viu e o que acabou de
    // ser relido, o servidor já ajustou as quantidades — mas o cliente nunca
    // pode ser redirecionado para uma confirmação que ele não concordou em
    // pagar sem ser avisado antes.
    if (cart.droppedCount > 0 || cart.items.some((item) => item.adjusted)) {
      return {
        error:
          "A disponibilidade de alguns itens mudou enquanto você preenchia os dados. Volte ao carrinho e confira antes de finalizar.",
      };
    }

    const shippingCents = 0; // frete entra quando a integração do Melhor Envio existir
    const totalCents = cart.subtotalCents + shippingCents;

    order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          userId,
          contactEmail,
          shippingAddress: parsed.address,
          shippingCents,
          totalCents,
          items: {
            create: cart.items.map((item) => ({
              variationId: item.variationId,
              quantity: item.quantity,
              priceCents: item.priceCents,
            })),
          },
        },
      });
    });
  } catch {
    // Se a checagem de disponibilidade retornou erro, ela já saiu antes daqui.
    return { error: "Não foi possível finalizar o pedido. Tente novamente." };
  }

  // redirect() lança uma exceção interna do Next.js — precisa ficar fora do
  // try/catch acima, senão um pedido criado com sucesso vira "erro" na tela.
  redirect(`/pedido/${order.id}/confirmacao`);
}
