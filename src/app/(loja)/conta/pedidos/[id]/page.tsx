import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";
import { readShippingAddress } from "@/lib/address";

export const dynamic = "force-dynamic";

export default async function MeuPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { id: userId } = await requireUser();

  // O `userId` no where é o que impede um cliente de abrir o pedido de outro
  // trocando o id na URL. Buscar só por id e comparar depois seria frágil.
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: { include: { variation: { include: { product: true } } }, orderBy: { id: "asc" } },
      shipment: true,
    },
  });

  if (!order) {
    notFound();
  }

  const address = readShippingAddress(order.shippingAddress);

  return (
    <div>
      <p>
        <Link href="/conta/pedidos">← Voltar para meus pedidos</Link>
      </p>
      <h1>Pedido #{order.number}</h1>
      <p>
        Status: <strong>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</strong>
      </p>
      <p>Feito em {order.createdAt.toLocaleString("pt-BR")}</p>

      {order.shipment?.trackingCode && (
        <p>
          Código de rastreio: <strong>{order.shipment.trackingCode}</strong>
          {order.shipment.carrier ? ` (${order.shipment.carrier})` : ""}
        </p>
      )}

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
      {address ? (
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
      ) : (
        <p>Endereço indisponível.</p>
      )}

      <h2>Total</h2>
      <p>Subtotal: R$ {centsToReais(order.totalCents - order.shippingCents)}</p>
      <p>
        Frete: {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}
      </p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>
    </div>
  );
}
