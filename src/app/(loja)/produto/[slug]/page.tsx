import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VariationSelector } from "./VariationSelector";

export const dynamic = "force-dynamic";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [product, settings] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variations: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      },
    }),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!product || !product.active || product.variations.length === 0) {
    notFound();
  }

  const pixDiscountPercent = settings?.pixDiscountPercent ?? 0;
  const maxInstallments = settings?.maxInstallments ?? 1;

  return (
    <div>
      <p>{product.category.name}</p>
      <h1>{product.name}</h1>
      {product.brand && <p>{product.brand}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        {product.images.length > 0 ? (
          product.images.map((url) => (
            <img
              key={url}
              src={url}
              alt={product.name}
              style={{ width: 300, height: 300, objectFit: "cover" }}
            />
          ))
        ) : (
          <div style={{ width: 300, height: 300, background: "#eee" }}>Sem imagem</div>
        )}
      </div>

      <VariationSelector
        variations={product.variations}
        pixDiscountPercent={pixDiscountPercent}
        maxInstallments={maxInstallments}
      />

      <h2>Descrição</h2>
      <p>{product.description}</p>
    </div>
  );
}
