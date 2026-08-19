# Admin: Catálogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono da loja consegue, pelo painel `/admin`, criar categorias, cadastrar produtos (com imagem via link colado), e gerenciar as variações de cada produto (tamanho, cor, preço e estoque).

**Architecture:** Continua o monólito Next.js do Plano 1. Páginas de servidor (Server Components) leem do Prisma diretamente; mutações passam por Server Actions (`"use server"`) conectadas a formulários via `useActionState`, devolvendo mensagens de erro sem recarregar a página. Nenhuma tabela nova — usa os modelos `Category`, `Product` e `ProductVariation` já migrados no Plano 1.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19 (`useActionState`), Prisma 7 (`@prisma/adapter-pg`)

**Spec:** `docs/superpowers/specs/2026-08-18-ecommerce-v1-design.md`

## Global Constraints

- Projeto usa Prisma 7: toda instanciação de `PrismaClient` em código da aplicação precisa do driver adapter (`@prisma/adapter-pg`) — mas isso já está resolvido no singleton `src/lib/prisma.ts` do Plano 1; **use sempre esse singleton (`import { prisma } from "@/lib/prisma"`), nunca instancie `PrismaClient` diretamente**.
- Projeto usa Next.js 16, que pode ter mudado APIs desde o conhecimento de treinamento do modelo (isso já aconteceu 2x no Plano 1 — `middleware.ts`→`src/proxy.ts`, e `params` de rota dinâmica virou `Promise` que precisa de `await`). Antes de assumir que uma API do Next.js/React funciona como no treinamento, verificar contra `node_modules/next/dist/docs/` ou o comportamento real, e documentar qualquer desvio forçado do jeito que o Plano 1 documentou os dele.
- **Nunca criar nem commitar um arquivo `.env.example`** (ou qualquer variante `.env.*.example`) — regra permanente do usuário, sem exceção.
- Dinheiro é armazenado em centavos (`priceCents: Int`), nunca como número decimal/float. Conversão de "R$ 129,90" (texto digitado pelo admin) para `12990` (centavos) acontece nas Server Actions, nunca no schema.
- Imagens de produto nesta fase são **links colados pelo admin** (texto), não upload de arquivo — decisão do usuário pra não precisar criar conta na Vercel ainda. O campo `Product.images` (`String[]`) recebe as URLs digitadas.
- Todas as páginas deste plano ficam sob `/admin`, já protegido pelo `src/proxy.ts` e `src/app/admin/layout.tsx` do Plano 1 — nenhuma proteção de acesso adicional é necessária nestas páginas.
- Slugs (`Product.slug`, `Category.slug`) são gerados com a função `slugify()` da Task 1 — nunca duplicar essa lógica em outro arquivo.
- Toda Server Action que faz mutação (create/update/delete) deve chamar `await requireAdmin()` (de `src/lib/require-admin.ts`, criado na Task 4) como primeira linha do corpo — depender só do redirect da `/admin/layout.tsx` não é suficiente, o endpoint da action é alcançável independente da página.

---

### Task 1: Utilitário de slug (com teste)

**Files:**
- Create: `src/lib/slug.ts`
- Test: `src/lib/slug.test.ts`

**Interfaces:**
- Produces: `slugify(input: string): string`

- [ ] **Step 1: Escrever o teste (deve falhar)**

Create `src/lib/slug.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugify("Camiseta Azul")).toBe("camiseta-azul");
  });

  it("removes accents", () => {
    expect(slugify("Calça Jeans Elastano")).toBe("calca-jeans-elastano");
  });

  it("collapses multiple spaces and trims", () => {
    expect(slugify("  Bermuda   Cargo  ")).toBe("bermuda-cargo");
  });

  it("strips characters that aren't letters, numbers, or spaces", () => {
    expect(slugify("Kit Camisa + Bermuda (Promo!)")).toBe("kit-camisa-bermuda-promo");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `src/lib/slug.ts` não existe ainda

- [ ] **Step 3: Implementar**

Create `src/lib/slug.ts`:
```typescript
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS nos 4 testes novos (mais os 3 já existentes de `password.test.ts` — 7 no total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: add slug generation utility"
```

---

### Task 2: Categorias — criar e listar

**Files:**
- Create: `src/app/admin/categorias/actions.ts`
- Create: `src/app/admin/categorias/CategoryForm.tsx`
- Create: `src/app/admin/categorias/page.tsx`

**Interfaces:**
- Consumes: `slugify` de `src/lib/slug.ts` (Task 1), `prisma` de `src/lib/prisma.ts` (Plano 1)
- Produces: `createCategory(prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string } | undefined>`

- [ ] **Step 1: Escrever a Server Action**

Create `src/app/admin/categorias/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

type CategoryActionState = { error?: string } | undefined;

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;

  if (!name) {
    return { error: "Nome é obrigatório" };
  }

  const slug = slugify(name);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Já existe uma categoria com esse nome" };
  }

  await prisma.category.create({
    data: { name, slug, parentId },
  });

  revalidatePath("/admin/categorias");
  return undefined;
}
```

- [ ] **Step 2: Criar o formulário (client component)**

Create `src/app/admin/categorias/CategoryForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { createCategory } from "./actions";

type Category = { id: string; name: string };
type ActionState = { error?: string } | undefined;

export function CategoryForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCategory,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="text" name="name" placeholder="Nome da categoria" required />
      <select name="parentId" defaultValue="">
        <option value="">Sem categoria pai</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      <button type="submit" disabled={pending}>
        Criar categoria
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Criar a página**

Create `src/app/admin/categorias/page.tsx`:
```tsx
import { prisma } from "@/lib/prisma";
import { CategoryForm } from "./CategoryForm";

export default async function CategoriasPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1>Categorias</h1>
      <CategoryForm categories={categories} />
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}
            {c.parentId ? " (subcategoria)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`. Logar como admin (credenciais já seedadas no Plano 1), acessar `/admin/categorias`. Criar uma categoria "Camisetas" — deve aparecer na lista sem recarregar a página inteira. Tentar criar "Camisetas" de novo — deve mostrar o erro "Já existe uma categoria com esse nome". Criar uma segunda categoria "Camisetas Estampadas" com "Camisetas" como pai — deve aparecer marcada como "(subcategoria)".

- [ ] **Step 5: Rodar a suíte de testes completa**

Run: `npm test`
Expected: PASS (os 7 testes anteriores continuam passando — esta task não adiciona testes automatizados, segue o padrão do Plano 1 de verificação manual para fluxos que tocam o banco/HTTP)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/categorias
git commit -m "feat: add category creation and listing in admin"
```

---

### Task 3: Produtos — listagem

**Files:**
- Create: `src/app/admin/produtos/page.tsx`

**Interfaces:**
- Consumes: `prisma` de `src/lib/prisma.ts` (Plano 1)

- [ ] **Step 1: Criar a página de listagem**

Create `src/app/admin/produtos/page.tsx`:
```tsx
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
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`. Acessar `/admin/produtos` logado como admin. Como não há produtos ainda, deve mostrar "Nenhum produto cadastrado ainda." e o link "Novo produto" (que vai dar 404 até a Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/produtos/page.tsx
git commit -m "feat: add product listing page in admin"
```

---

### Task 4: Produtos — criar

**Files:**
- Create: `src/app/admin/produtos/actions.ts`
- Create: `src/app/admin/produtos/ProductForm.tsx`
- Create: `src/app/admin/produtos/novo/page.tsx`

**Interfaces:**
- Consumes: `slugify` de `src/lib/slug.ts` (Task 1), `prisma` de `src/lib/prisma.ts` (Plano 1)
- Produces: `createProduct(prevState, formData): Promise<{ error?: string } | undefined>` (redireciona em vez de retornar em caso de sucesso)
- Produces: `ProductForm` (client component) — usado também na Task 5 (edição), aceita `defaultValues` opcionais incluindo `id` e `active` para diferenciar modo criação/edição

- [ ] **Step 1: Escrever a Server Action de criação**

Create `src/app/admin/produtos/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { redirect } from "next/navigation";

export type ProductActionState = { error?: string } | undefined;

function parseImages(formData: FormData): string[] {
  const raw = String(formData.get("images") ?? "");
  return raw
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "");
  const images = parseImages(formData);

  if (!name || !description || !categoryId) {
    return { error: "Nome, descrição e categoria são obrigatórios" };
  }

  const slug = slugify(name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Já existe um produto com esse nome" };
  }

  const product = await prisma.product.create({
    data: { name, slug, description, brand, categoryId, images },
  });

  redirect(`/admin/produtos/${product.id}`);
}
```

- [ ] **Step 2: Criar o formulário compartilhado (client component)**

Create `src/app/admin/produtos/ProductForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import type { ProductActionState } from "./actions";

type Category = { id: string; name: string };

type DefaultValues = {
  id?: string;
  name: string;
  description: string;
  brand: string | null;
  categoryId: string;
  active?: boolean;
  images?: string[];
};

export function ProductForm({
  categories,
  action,
  defaultValues,
}: {
  categories: Category[];
  action: (prevState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  defaultValues?: DefaultValues;
}) {
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction}>
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <input type="text" name="name" placeholder="Nome" defaultValue={defaultValues?.name} required />
      <textarea
        name="description"
        placeholder="Descrição"
        defaultValue={defaultValues?.description}
        required
      />
      <input
        type="text"
        name="brand"
        placeholder="Marca (opcional)"
        defaultValue={defaultValues?.brand ?? ""}
      />
      <select name="categoryId" defaultValue={defaultValues?.categoryId ?? ""} required>
        <option value="" disabled>
          Selecione uma categoria
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        name="images"
        placeholder="Uma URL de imagem por linha (opcional)"
        defaultValue={defaultValues?.images?.join("\n") ?? ""}
      />
      {defaultValues?.id && (
        <label>
          <input type="checkbox" name="active" defaultChecked={defaultValues.active ?? true} />
          Ativo (visível na loja)
        </label>
      )}
      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      <button type="submit" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Criar a página "novo produto"**

Create `src/app/admin/produtos/novo/page.tsx`:
```tsx
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
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`. Certificar que existe pelo menos 1 categoria criada (Task 2). Acessar `/admin/produtos/novo`, preencher nome/descrição/categoria, colar uma URL de imagem qualquer, salvar — deve redirecionar para `/admin/produtos/[id]` (que ainda dá 404 até a Task 5, mas a URL deve ter o formato certo). Voltar em `/admin/produtos` e confirmar que o produto aparece na lista. Tentar criar outro produto com o mesmo nome — deve mostrar erro "Já existe um produto com esse nome" sem sair da página.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/produtos/actions.ts src/app/admin/produtos/ProductForm.tsx src/app/admin/produtos/novo
git commit -m "feat: add product creation form in admin"
```

---

### Task 5: Produtos — editar e gerenciar variações (tamanho/cor/preço/estoque)

**Files:**
- Modify: `src/app/admin/produtos/actions.ts` (adicionar `updateProduct`, `createVariation`, `updateVariation`, `deleteVariation`)
- Create: `src/app/admin/produtos/[id]/page.tsx`
- Create: `src/app/admin/produtos/[id]/VariationsManager.tsx`

**Interfaces:**
- Consumes: `ProductForm` de `src/app/admin/produtos/ProductForm.tsx` (Task 4), `ProductActionState` de `src/app/admin/produtos/actions.ts` (Task 4), `prisma` de `src/lib/prisma.ts` (Plano 1)
- Produces: `updateProduct(prevState, formData): Promise<ProductActionState>`, `createVariation(prevState, formData): Promise<ProductActionState>`, `updateVariation(prevState, formData): Promise<ProductActionState>`, `deleteVariation(prevState, formData): Promise<ProductActionState>`

Nota sobre exclusão: `OrderItem` referencia `ProductVariation` com `onDelete` padrão (`RESTRICT`) — excluir uma variação que já tem pedido associado falharia com um erro de banco feio. `deleteVariation` verifica isso antes e devolve uma mensagem amigável em vez de deixar o erro estourar. Produtos, por sua vez, **nunca são excluídos de verdade** nesta fase — só desativados via o checkbox "Ativo" do `ProductForm` (soft delete), evitando o mesmo problema em cascata com variações e pedidos.

- [ ] **Step 1: Adicionar as novas Server Actions**

Modify `src/app/admin/produtos/actions.ts`. O arquivo (da Task 4) começa assim:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { redirect } from "next/navigation";

export type ProductActionState = { error?: string } | undefined;

function parseImages(formData: FormData): string[] { /* ... */ }

export async function createProduct(/* ... */) { /* ... */ }
```

Nota de segurança (descoberta durante a Task 4 deste plano): toda Server Action que faz mutação precisa verificar autenticação/autorização por conta própria — depender só do redirect da `/admin/layout.tsx` não basta, porque o endpoint da Server Action é alcançável independente da página (o id da action fica no bundle JS do cliente). A Task 4 já criou `src/lib/require-admin.ts`:
```typescript
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    throw new Error("Não autorizado");
  }
}
```
Todas as quatro funções novas abaixo devem chamar `await requireAdmin();` como a primeira linha do corpo, antes de ler `formData` ou tocar no banco.

Três mudanças:
1. Adicionar `import { revalidatePath } from "next/cache";` junto com os outros imports do topo (não duplicar o bloco de imports — só acrescentar essa linha às já existentes: `prisma`, `slugify`, `redirect`).
2. Adicionar `import { requireAdmin } from "@/lib/require-admin";` junto com os mesmos imports do topo.
3. Adicionar as quatro funções abaixo **ao final do arquivo**, depois de `createProduct` — mantendo `createProduct` e `parseImages` exatamente como estão:

```typescript
export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "");
  const active = formData.get("active") === "on";
  const images = parseImages(formData);

  if (!id || !name || !description || !categoryId) {
    return { error: "Nome, descrição e categoria são obrigatórios" };
  }

  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) {
    return { error: "Produto não encontrado" };
  }

  let slug = current.slug;
  if (name !== current.name) {
    const newSlug = slugify(name);
    const collision = await prisma.product.findFirst({ where: { slug: newSlug, NOT: { id } } });
    if (collision) {
      return { error: "Já existe outro produto com esse nome" };
    }
    slug = newSlug;
  }

  await prisma.product.update({
    where: { id },
    data: { name, slug, description, brand, categoryId, active, images },
  });

  revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/admin/produtos");
  return undefined;
}

export async function createVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const size = String(formData.get("size") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const priceInput = String(formData.get("price") ?? "").trim();
  const stock = Number(formData.get("stock") ?? 0);

  if (!productId || !size || !color || !priceInput) {
    return { error: "Tamanho, cor e preço são obrigatórios" };
  }

  const priceCents = Math.round(Number(priceInput.replace(",", ".")) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Preço inválido" };
  }

  const existing = await prisma.productVariation.findUnique({
    where: { productId_size_color: { productId, size, color } },
  });
  if (existing) {
    return { error: "Já existe uma variação com esse tamanho e cor" };
  }

  const sku = `${productId.slice(0, 8)}-${size}-${color}`.toUpperCase().replace(/\s+/g, "");

  try {
    await prisma.productVariation.create({
      data: { productId, size, color, sku, priceCents, stock: Math.max(0, stock) },
    });
  } catch {
    return { error: "Não foi possível criar a variação (SKU duplicado?)" };
  }

  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}

export async function updateVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const priceInput = String(formData.get("price") ?? "").trim();
  const stock = Number(formData.get("stock") ?? 0);

  if (!id || !priceInput) {
    return { error: "Preço é obrigatório" };
  }

  const priceCents = Math.round(Number(priceInput.replace(",", ".")) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Preço inválido" };
  }

  await prisma.productVariation.update({
    where: { id },
    data: { priceCents, stock: Math.max(0, stock) },
  });

  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}

export async function deleteVariation(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const orderItemCount = await prisma.orderItem.count({ where: { variationId: id } });
  if (orderItemCount > 0) {
    return { error: "Não é possível excluir: essa variação já tem pedidos associados" };
  }

  await prisma.productVariation.delete({ where: { id } });
  revalidatePath(`/admin/produtos/${productId}`);
  return undefined;
}
```

- [ ] **Step 2: Criar o gerenciador de variações (client component)**

Create `src/app/admin/produtos/[id]/VariationsManager.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { createVariation, updateVariation, deleteVariation } from "../actions";
import type { ProductActionState } from "../actions";

type Variation = {
  id: string;
  size: string;
  color: string;
  sku: string;
  priceCents: number;
  stock: number;
};

function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function VariationRow({ variation, productId }: { variation: Variation; productId: string }) {
  const [updateState, updateActionBound, updatePending] = useActionState<
    ProductActionState,
    FormData
  >(updateVariation, undefined);
  const [deleteState, deleteActionBound, deletePending] = useActionState<
    ProductActionState,
    FormData
  >(deleteVariation, undefined);

  return (
    <tr>
      <td>{variation.size}</td>
      <td>{variation.color}</td>
      <td>{variation.sku}</td>
      <td>
        <form action={updateActionBound} style={{ display: "inline-flex", gap: 4 }}>
          <input type="hidden" name="id" value={variation.id} />
          <input type="hidden" name="productId" value={productId} />
          <input type="text" name="price" defaultValue={centsToReais(variation.priceCents)} size={6} />
          <input type="number" name="stock" defaultValue={variation.stock} min={0} size={4} />
          <button type="submit" disabled={updatePending}>
            Salvar
          </button>
        </form>
        {updateState?.error && <p style={{ color: "red" }}>{updateState.error}</p>}
      </td>
      <td>
        <form action={deleteActionBound}>
          <input type="hidden" name="id" value={variation.id} />
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" disabled={deletePending}>
            Excluir
          </button>
        </form>
        {deleteState?.error && <p style={{ color: "red" }}>{deleteState.error}</p>}
      </td>
    </tr>
  );
}

export function VariationsManager({
  variations,
  productId,
}: {
  variations: Variation[];
  productId: string;
}) {
  const [createState, createActionBound, createPending] = useActionState<
    ProductActionState,
    FormData
  >(createVariation, undefined);

  return (
    <div>
      <h2>Variações (tamanho / cor / estoque)</h2>
      <table>
        <thead>
          <tr>
            <th>Tamanho</th>
            <th>Cor</th>
            <th>SKU</th>
            <th>Preço (R$) / Estoque</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {variations.map((v) => (
            <VariationRow key={v.id} variation={v} productId={productId} />
          ))}
        </tbody>
      </table>

      <h3>Adicionar variação</h3>
      <form action={createActionBound}>
        <input type="hidden" name="productId" value={productId} />
        <input type="text" name="size" placeholder="Tamanho (ex: M)" required />
        <input type="text" name="color" placeholder="Cor (ex: Azul)" required />
        <input type="text" name="price" placeholder="Preço (ex: 129,90)" required />
        <input type="number" name="stock" placeholder="Estoque" min={0} defaultValue={0} />
        <button type="submit" disabled={createPending}>
          Adicionar
        </button>
      </form>
      {createState?.error && <p style={{ color: "red" }}>{createState.error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Criar a página de edição**

Create `src/app/admin/produtos/[id]/page.tsx`. Nota: neste projeto (Next.js 16), `params` de rota dinâmica é uma `Promise` que precisa de `await` (confirmado no Plano 1) — se essa API tiver mudado de novo, verificar `node_modules/next/dist/docs/` antes de forçar o código abaixo.

```tsx
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
    include: { variations: { orderBy: [{ size: "asc" }, { color: "asc" }] } },
  });

  if (!product) {
    notFound();
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

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
      <VariationsManager variations={product.variations} productId={product.id} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar manualmente o ciclo completo**

Run: `npm run dev`. A partir de `/admin/produtos`, editar o produto criado na Task 4 — deve abrir com os dados preenchidos. Adicionar uma variação (ex: tamanho M, cor Azul, preço 99,90, estoque 10) — deve aparecer na tabela sem recarregar a página. Editar o estoque dessa variação pra 5 e salvar — deve refletir na tabela. Tentar adicionar outra variação com o mesmo tamanho+cor — deve mostrar erro. Excluir a variação — deve sumir da tabela. Desmarcar "Ativo" e salvar — voltar em `/admin/produtos` e confirmar que o status mudou para "Inativo".

- [ ] **Step 5: Rodar a suíte de testes completa**

Run: `npm test`
Expected: PASS (7 testes — password + slug — continuam passando; esta task não adiciona testes automatizados, consistente com o padrão de verificação manual do Plano 1 para fluxos de banco/HTTP)

- [ ] **Step 6: Rodar o build de produção**

Run: `npm run build`
Expected: build completa sem erros (confirma que as rotas dinâmicas e Server Actions compilam corretamente)

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/produtos
git commit -m "feat: add product editing and variation management in admin"
```

## Definição de pronto (Plano 2)

- [ ] `npm run dev` sobe sem erros
- [ ] `npm run build` completa sem erros
- [ ] `npm test` passa (7 testes)
- [ ] Admin consegue criar categoria, criar produto com imagem (link colado), editar produto, adicionar/editar/excluir variações com estoque por tamanho/cor
- [ ] Produto sem variações mostra estoque total 0 na listagem; produto com variações soma o estoque corretamente
- [ ] Nenhum arquivo `.env.example` foi criado
