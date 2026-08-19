import { prisma } from "@/lib/prisma";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export default async function NovoProdutoPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1>Novo produto</h1>
      <ProductForm categories={categories} action={createProduct} />
    </div>
  );
}
