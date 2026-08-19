import Link from "next/link";
import { centsToReais, applyPixDiscount } from "@/lib/money";

type ProductCardProduct = {
  slug: string;
  name: string;
  images: string[];
  variations: { priceCents: number; stock: number }[];
};

export function ProductCard({
  product,
  pixDiscountPercent,
}: {
  product: ProductCardProduct;
  pixDiscountPercent: number;
}) {
  const minPriceCents = Math.min(...product.variations.map((v) => v.priceCents));
  const totalStock = product.variations.reduce((sum, v) => sum + v.stock, 0);
  const pixPriceCents = applyPixDiscount(minPriceCents, pixDiscountPercent);
  const image = product.images[0];

  return (
    <Link
      href={`/produto/${product.slug}`}
      style={{ display: "block", border: "1px solid #ddd", padding: 8, textDecoration: "none", color: "inherit" }}
    >
      {image ? (
        <img src={image} alt={product.name} style={{ width: "100%", height: 200, objectFit: "cover" }} />
      ) : (
        <div
          style={{
            width: "100%",
            height: 200,
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Sem imagem
        </div>
      )}
      <h3>{product.name}</h3>
      {totalStock === 0 ? (
        <p>Esgotado</p>
      ) : (
        <>
          <p>a partir de R$ {centsToReais(minPriceCents)}</p>
          <p>
            ou R$ {centsToReais(pixPriceCents)} no Pix ({pixDiscountPercent}% OFF)
          </p>
        </>
      )}
    </Link>
  );
}
