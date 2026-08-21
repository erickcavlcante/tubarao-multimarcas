import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Bem-vindo ao painel administrativo.</p>
      <ul>
        <li>
          <Link href="/admin/produtos">Produtos</Link>
        </li>
        <li>
          <Link href="/admin/categorias">Categorias</Link>
        </li>
        <li>
          <Link href="/admin/pedidos">Pedidos</Link>
        </li>
        <li>
          <Link href="/admin/configuracoes">Configurações</Link>
        </li>
      </ul>
    </div>
  );
}
