import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { readShippingAddress } from "@/lib/address";
import { ClearCart } from "./ClearCart";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const STATUS_MESSAGE: Record<string, string> = {
  AWAITING_PAYMENT:
    "O pagamento ainda não foi processado — a loja entrará em contato pelo email informado.",
  PAID: "Pagamento confirmado. Estamos preparando seu pedido para envio.",
  PAID_STOCK_ISSUE:
    "Pagamento confirmado, mas houve um problema com o estoque de um item. A loja entrará em contato.",
  SHIPPED: "Seu pedido foi enviado.",
  DELIVERED: "Seu pedido foi entregue.",
  CANCELED: "Este pedido foi cancelado.",
};

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

  const address = readShippingAddress(order.shippingAddress);

  return (
    <div>
      <ClearCart orderId={order.id} />
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
      <p>Frete: {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}</p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>

      <p style={{ color: "#666" }}>{STATUS_MESSAGE[order.status] ?? ""}</p>
      <Link href="/produtos">Continuar comprando</Link>
    </div>
  );
}
