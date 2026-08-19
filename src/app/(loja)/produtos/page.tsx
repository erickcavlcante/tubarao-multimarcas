import { prisma } from "@/lib/prisma";
import { getFilteredProducts, getFilterOptions, type ProductFilters } from "@/lib/catalog";
import { ProductCard } from "../_components/ProductCard";

export const dynamic = "force-dynamic";

function firstValue(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tamanho = firstValue(params.tamanho);
  const cor = firstValue(params.cor);
  const marca = firstValue(params.marca);
  const ordenar = firstValue(params.ordenar);
  const filters: ProductFilters = {
    size: tamanho,
    color: cor,
    brand: marca,
    sort: ordenar as ProductFilters["sort"],
  };

  const [products, options, settings] = await Promise.all([
    getFilteredProducts(filters),
    getFilterOptions(),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);
  const pixDiscountPercent = settings?.pixDiscountPercent ?? 0;

  return (
    <div>
      <h1>Produtos</h1>
      <form method="get">
        <select name="tamanho" defaultValue={tamanho ?? ""}>
          <option value="">Todos os tamanhos</option>
          {options.sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="cor" defaultValue={cor ?? ""}>
          <option value="">Todas as cores</option>
          {options.colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="marca" defaultValue={marca ?? ""}>
          <option value="">Todas as marcas</option>
          {options.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select name="ordenar" defaultValue={ordenar ?? ""}>
          <option value="">Mais recentes</option>
          <option value="menor-preco">Menor preço</option>
          <option value="maior-preco">Maior preço</option>
        </select>
        <button type="submit">Filtrar</button>
      </form>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} pixDiscountPercent={pixDiscountPercent} />
        ))}
      </div>
      {products.length === 0 && <p>Nenhum produto encontrado.</p>}
    </div>
  );
}
