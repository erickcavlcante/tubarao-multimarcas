import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ProdutosPage() {
  const products = await prisma.product.findMany({
    include: { category: true, variations: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Produtos</h1>
      <p>
        <Link href="/admin/produtos/novo">Novo produto</Link>
      </p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Estoque total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const totalStock = p.variations.reduce((sum, v) => sum + v.stock, 0);
            return (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category.name}</td>
                <td>{totalStock}</td>
                <td>{p.active ? "Ativo" : "Inativo"}</td>
                <td>
                  <Link href={`/admin/produtos/${p.id}`}>Editar</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {products.length === 0 && <p>Nenhum produto cadastrado ainda.</p>}
    </div>
  );
}
