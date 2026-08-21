import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function MeusPedidosPage() {
  const { id: userId } = await requireUser();

  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Meus pedidos</h1>
      {orders.length === 0 ? (
        <p>
          Você ainda não fez nenhum pedido com esta conta. <Link href="/produtos">Ver produtos</Link>
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.number}</td>
                <td>{order.createdAt.toLocaleDateString("pt-BR")}</td>
                <td>{order.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                <td>R$ {centsToReais(order.totalCents)}</td>
                <td>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</td>
                <td>
                  <Link href={`/conta/pedidos/${order.id}`}>Detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
