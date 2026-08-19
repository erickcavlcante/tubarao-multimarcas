import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../ProductForm";
import { updateProduct } from "../actions";
import { VariationsManager } from "./VariationsManager";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variations: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });

  if (!product) {
    notFound();
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const suggestedWeightGrams =
    product.category.defaultWeightGrams ?? settings?.defaultWeightGrams ?? 300;

  return (
    <div>
      <h1>Editar produto</h1>
      <ProductForm
        categories={categories}
        action={updateProduct}
        defaultValues={{
          id: product.id,
          name: product.name,
          description: product.description,
          brand: product.brand,
          categoryId: product.categoryId,
          active: product.active,
          images: product.images,
        }}
      />
      <VariationsManager
        variations={product.variations}
        productId={product.id}
        suggestedWeightGrams={suggestedWeightGrams}
      />
    </div>
  );
}
