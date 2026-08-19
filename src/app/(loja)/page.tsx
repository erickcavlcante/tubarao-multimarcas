import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCategories, getRecentActiveProducts } from "@/lib/catalog";
import { ProductCard } from "./_components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products, settings] = await Promise.all([
    getCategories(),
    getRecentActiveProducts(8),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);

  const pixDiscountPercent = settings?.pixDiscountPercent ?? 0;

  return (
    <div>
      <section>
        <h1>Novidades</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} pixDiscountPercent={pixDiscountPercent} />
          ))}
        </div>
        {products.length === 0 && <p>Nenhum produto disponível ainda.</p>}
      </section>
      <section>
        <h2>Categorias</h2>
        <ul>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/produtos/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
        {categories.length === 0 && <p>Nenhuma categoria cadastrada ainda.</p>}
      </section>
    </div>
  );
}
