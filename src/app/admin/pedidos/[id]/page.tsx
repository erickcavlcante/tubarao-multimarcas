import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";
import { readShippingAddress } from "@/lib/address";

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { variation: { include: { product: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const address = readShippingAddress(order.shippingAddress);

  return (
    <div>
      <p>
        <Link href="/admin/pedidos">← Voltar para pedidos</Link>
      </p>
      <h1>Pedido #{order.number}</h1>
      <p>
        Status: <strong>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</strong>
      </p>
      <p>Feito em {order.createdAt.toLocaleString("pt-BR")}</p>
      <p>Cliente: {order.contactEmail}</p>

      <h2>Itens</h2>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Variação</th>
            <th>SKU</th>
            <th>Qtd</th>
            <th>Preço unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.variation.product.name}</td>
              <td>
                {item.variation.size} - {item.variation.color}
              </td>
              <td>{item.variation.sku}</td>
              <td>{item.quantity}</td>
              <td>R$ {centsToReais(item.priceCents)}</td>
              <td>R$ {centsToReais(item.priceCents * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
        <p>Endereço indisponível (dado inválido no pedido).</p>
      )}

      <h2>Valores</h2>
      <p>Subtotal: R$ {centsToReais(order.totalCents - order.shippingCents)}</p>
      <p>
        Frete:{" "}
        {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}
      </p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>
    </div>
  );
}
