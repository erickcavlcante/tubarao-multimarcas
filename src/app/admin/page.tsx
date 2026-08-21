import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

const LOW_STOCK_THRESHOLD = 3;

export default async function AdminDashboardPage() {
  const [recentOrders, awaitingCount, lowStock] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    prisma.productVariation.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { active: true } },
      include: { product: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <h1>Dashboard</h1>

      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/produtos">Produtos</Link>
        <Link href="/admin/categorias">Categorias</Link>
        <Link href="/admin/configuracoes">Configurações</Link>
      </nav>

      {awaitingCount > 0 && (
        <p style={{ background: "#fef3c7", padding: 8 }}>
          {awaitingCount} pedido(s) aguardando pagamento.{" "}
          <Link href="/admin/pedidos?status=AWAITING_PAYMENT">Ver</Link>
        </p>
      )}

      <h2>Pedidos recentes</h2>
      {recentOrders.length === 0 ? (
        <p>Nenhum pedido ainda.</p>
      ) : (
        <ul>
          {recentOrders.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/pedidos/${order.id}`}>#{order.number}</Link> —{" "}
              {order.createdAt.toLocaleDateString("pt-BR")} — R$ {centsToReais(order.totalCents)} —{" "}
              {ORDER_STATUS_LABELS[order.status as OrderStatusValue]}
            </li>
          ))}
        </ul>
      )}

      <h2>Estoque baixo (até {LOW_STOCK_THRESHOLD} unidades)</h2>
      {lowStock.length === 0 ? (
        <p>Nenhuma variação com estoque baixo.</p>
      ) : (
        <ul>
          {lowStock.map((variation) => (
            <li key={variation.id}>
              <Link href={`/admin/produtos/${variation.productId}`}>
                {variation.product.name}
              </Link>{" "}
              ({variation.size} - {variation.color}): {variation.stock} em estoque
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
