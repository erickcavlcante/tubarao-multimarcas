import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import type { ShippingAddress } from "@/lib/address";

export const dynamic = "force-dynamic";

export default async function ConfirmacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          variation: { include: { product: true } },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const address = order.shippingAddress as unknown as ShippingAddress;

  return (
    <div>
      <h1>Pedido confirmado</h1>
      <p style={{ fontSize: 20 }}>
        Seu número de pedido é <strong>#{order.number}</strong>
      </p>
      <p>
        Enviamos a confirmação para <strong>{order.contactEmail}</strong>. Guarde o número do
        pedido para acompanhar sua compra.
      </p>

      <h2>Itens</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}x {item.variation.product.name} ({item.variation.size} -{" "}
            {item.variation.color}) — R$ {centsToReais(item.priceCents * item.quantity)}
          </li>
        ))}
      </ul>

      <h2>Entrega</h2>
      <p>
        {address.recipientName}
        <br />
        {address.street}, {address.number}
        {address.complement ? ` - ${address.complement}` : ""}
        <br />
        {address.neighborhood} - {address.city}/{address.state}
        <br />
        CEP {address.zipCode}
      </p>

      <h2>Total</h2>
      <p>Subtotal: R$ {centsToReais(order.totalCents - order.shippingCents)}</p>
      <p>Frete: {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}</p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>

      <p style={{ color: "#666" }}>
        O pagamento ainda não foi processado — a loja entrará em contato pelo email informado.
      </p>
      <Link href="/produtos">Continuar comprando</Link>
    </div>
  );
}
