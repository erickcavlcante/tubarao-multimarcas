import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "AWAITING_PAYMENT", label: "Aguardando pagamento" },
  { value: "PAID", label: "Pago" },
  { value: "PAID_STOCK_ISSUE", label: "Problema de estoque" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELED", label: "Cancelado" },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const validStatus = STATUS_FILTERS.some((f) => f.value === rawStatus && f.value !== "")
    ? (rawStatus as OrderStatusValue)
    : undefined;

  const orders = await prisma.order.findMany({
    where: validStatus ? { status: validStatus } : undefined,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Pedidos</h1>

      <form method="get">
        <label>
          Status:{" "}
          <select name="status" defaultValue={validStatus ?? ""}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Data</th>
            <th>Cliente</th>
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
              <td>{order.contactEmail}</td>
              <td>{order.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
              <td>R$ {centsToReais(order.totalCents)}</td>
              <td>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</td>
              <td>
                <Link href={`/admin/pedidos/${order.id}`}>Ver</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p>Nenhum pedido encontrado.</p>}
    </div>
  );
}
