# Loja: Vitrine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um visitante consegue abrir o site público, ver a home com produtos e categorias, navegar pelo catálogo com filtros (tamanho/cor/marca/ordenação), entrar numa categoria específica, e ver a página de um produto com galeria, seleção de tamanho/cor, preço com desconto Pix e parcelamento.

**Architecture:** Continua o monólito Next.js. As páginas da loja pública ficam num route group `src/app/(loja)/` (não muda a URL, só agrupa o layout — mantém `/admin` e `/login` intocados). Páginas são Server Components que leem direto do Prisma via funções compartilhadas em `src/lib/catalog.ts`; a única interatividade client-side é o seletor de variação na página de produto. Sem carrinho/compra nesta fase — isso é o Plano 4.

**Tech Stack:** Next.js 16 (App Router, route groups), React 19, Prisma 7

**Spec:** `docs/superpowers/specs/2026-08-18-ecommerce-v1-design.md`

## Global Constraints

- Projeto usa Prisma 7: sempre usar o singleton `src/lib/prisma.ts` (`import { prisma } from "@/lib/prisma"`), nunca instanciar `PrismaClient` diretamente.
- Projeto usa Next.js 16, com mudanças reais de API já confirmadas neste projeto (rename `middleware.ts`→`src/proxy.ts`, `params` de rota dinâmica é `Promise`). **`AGENTS.md` na raiz do repo e `node_modules/next/dist/docs/` são reais** — um implementador de uma task anterior (Plano 2) chegou a afirmar incorretamente que esses arquivos não existiam; foi verificado e corrigido no ledger daquele plano. Não repetir esse engano: se o código deste plano não compilar como esperado, checar `node_modules/next/dist/docs/` de verdade antes de assumir que é ruído.
- **Toda página deste plano é pública** (sem login) — não usar `requireAdmin()` nem verificar sessão em nenhuma delas.
- **Toda consulta de produto pro público deve filtrar `active: true` E `variations: { some: {} }`** (produto inativo, ou sem nenhuma variação cadastrada, não pode aparecer nem ser acessível na loja — decisão registrada no review final do Plano 2, já que produto sem variação não tem preço).
- Dinheiro em centavos, nunca float — usar `centsToReais()` (já existe em `src/lib/money.ts`) e a nova `applyPixDiscount()` desta plano.
- Imagens de produto são URLs arbitrárias coladas pelo admin (Plano 2), hosts desconhecidos de antemão — **usar `<img>` simples, nunca `next/image`** (que exigiria configurar `images.remotePatterns` com hosts conhecidos, o que não é possível aqui).
- **Nenhum botão "Adicionar ao carrinho" ou fluxo de compra nesta fase** — carrinho é o Plano 4. Esta plano é só navegação/vitrine.
- **Nunca criar nem commitar um arquivo `.env.example`.**

---

### Task 1: Layout da loja, home, e componente de card de produto

**Files:**
- Create: `src/app/(loja)/layout.tsx`
- Create: `src/app/(loja)/page.tsx`
- Create: `src/app/(loja)/_components/ProductCard.tsx`
- Create: `src/lib/catalog.ts`
- Modify: `src/lib/money.ts` (adicionar `applyPixDiscount`)
- Delete: `src/app/page.tsx` (a home placeholder do create-next-app — vira `src/app/(loja)/page.tsx`)

**Interfaces:**
- Consumes: `centsToReais` de `src/lib/money.ts` (já existe), `prisma` de `src/lib/prisma.ts`
- Produces: `applyPixDiscount(cents: number, discountPercent: number): number` em `src/lib/money.ts`
- Produces: `getCategories(): Promise<Category[]>`, `getRecentActiveProducts(limit: number): Promise<ProductWithVariations[]>` em `src/lib/catalog.ts` (onde `ProductWithVariations` inclui `category` e `variations`)
- Produces: `ProductCard` (componente), aceita `{ product: { slug, name, images, variations: { priceCents, stock }[] }, pixDiscountPercent: number }` — reutilizado pelas Tasks 2 e 3

- [ ] **Step 1: Adicionar `applyPixDiscount` ao `money.ts`**

Modify `src/lib/money.ts` — adicionar ao final do arquivo (mantendo `parsePriceToCents` e `centsToReais` como já estão):

```typescript
export function applyPixDiscount(cents: number, discountPercent: number): number {
  return Math.round(cents * (1 - discountPercent / 100));
}
```

- [ ] **Step 2: Criar as funções de consulta do catálogo**

Create `src/lib/catalog.ts`:
```typescript
import { prisma } from "@/lib/prisma";

const PRODUCT_INCLUDE = {
  category: true,
  variations: true,
} as const;

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getRecentActiveProducts(limit: number) {
  return prisma.product.findMany({
    where: { active: true, variations: { some: {} } },
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
```

- [ ] **Step 3: Criar o `ProductCard`**

Create `src/app/(loja)/_components/ProductCard.tsx`:
```tsx
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
```

- [ ] **Step 4: Criar o layout da loja**

Create `src/app/(loja)/layout.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const freeShippingReais = settings
    ? (settings.freeShippingCents / 100).toFixed(2).replace(".", ",")
    : null;

  return (
    <div>
      <header style={{ borderBottom: "1px solid #ddd", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ fontWeight: "bold", fontSize: 20, textDecoration: "none", color: "inherit" }}>
            Loja
          </Link>
          <nav>
            <Link href="/produtos">Todos os produtos</Link>
          </nav>
        </div>
        {freeShippingReais && (
          <p style={{ textAlign: "center", background: "#f5f5f5", padding: 4, margin: "8px 0 0" }}>
            Frete grátis em compras acima de R$ {freeShippingReais}
          </p>
        )}
      </header>
      <main style={{ padding: 16 }}>{children}</main>
      <footer style={{ borderTop: "1px solid #ddd", padding: 16, marginTop: 32 }}>
        <p>Loja de roupas masculinas</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: Apagar a home antiga e criar a nova**

Delete `src/app/page.tsx` (a home padrão do `create-next-app` — vai dar conflito de rota se não for removida, já que a nova home fica em `src/app/(loja)/page.tsx`).

Create `src/app/(loja)/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCategories, getRecentActiveProducts } from "@/lib/catalog";
import { ProductCard } from "./_components/ProductCard";

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
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`. Acessar `/` (sem estar logado — página pública). Deve mostrar os produtos cadastrados no Plano 2 (com preço "a partir de" e desconto Pix), e as categorias com link. Se algum produto do Plano 2 ficou sem variação (ex: o produto de teste do Task 4/5 do Plano 2 pode ter ficado sem variações depois da limpeza manual), confirmar que ele **não aparece** aqui (por causa do filtro `variations: { some: {} }`). Clicar numa categoria deve ir para `/produtos/[slug]` (que ainda 404 até a Task 3).

- [ ] **Step 7: Rodar a suíte de testes completa**

Run: `npm test`
Expected: PASS (13 testes já existentes — esta task não adiciona testes automatizados, `applyPixDiscount` é simples o bastante e será exercitada indiretamente pela verificação manual; segue o padrão já estabelecido nos Planos 1-2 de testar só lógica pura mais crítica)

- [ ] **Step 8: Commit**

```bash
git add src/app/\(loja\) src/lib/catalog.ts src/lib/money.ts
git rm src/app/page.tsx
git commit -m "feat: add store layout, home page, and product card"
```

---

### Task 2: Catálogo de produtos com filtros (`/produtos`)

**Files:**
- Modify: `src/lib/catalog.ts` (adicionar `ProductFilters`, `getFilteredProducts`, `getFilterOptions`)
- Create: `src/app/(loja)/produtos/page.tsx`

**Interfaces:**
- Consumes: `ProductCard` de `src/app/(loja)/_components/ProductCard.tsx` (Task 1), `prisma` de `src/lib/prisma.ts`
- Produces: `type ProductFilters = { categorySlug?: string; size?: string; color?: string; brand?: string; sort?: "recentes" | "menor-preco" | "maior-preco" }`, `getFilteredProducts(filters: ProductFilters): Promise<ProductWithVariations[]>`, `getFilterOptions(): Promise<{ sizes: string[]; colors: string[]; brands: string[] }>` — reutilizados pela Task 3

- [ ] **Step 1: Adicionar as funções de filtro ao `catalog.ts`**

Modify `src/lib/catalog.ts` — adicionar ao final do arquivo (mantendo `getCategories` e `getRecentActiveProducts` como já estão):

```typescript
export type ProductFilters = {
  categorySlug?: string;
  size?: string;
  color?: string;
  brand?: string;
  sort?: "recentes" | "menor-preco" | "maior-preco";
};

export async function getFilteredProducts(filters: ProductFilters) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      variations: { some: {} },
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
      ...(filters.brand ? { brand: filters.brand } : {}),
      ...(filters.size || filters.color
        ? {
            variations: {
              some: {
                ...(filters.size ? { size: filters.size } : {}),
                ...(filters.color ? { color: filters.color } : {}),
              },
            },
          }
        : {}),
    },
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const withMinPrice = products.map((p) => ({
    ...p,
    minPriceCents: Math.min(...p.variations.map((v) => v.priceCents)),
  }));

  if (filters.sort === "menor-preco") {
    withMinPrice.sort((a, b) => a.minPriceCents - b.minPriceCents);
  } else if (filters.sort === "maior-preco") {
    withMinPrice.sort((a, b) => b.minPriceCents - a.minPriceCents);
  }

  return withMinPrice;
}

export async function getFilterOptions() {
  const variations = await prisma.productVariation.findMany({
    select: { size: true, color: true },
    distinct: ["size", "color"],
  });
  const products = await prisma.product.findMany({
    where: { active: true, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  });
  return {
    sizes: Array.from(new Set(variations.map((v) => v.size))).sort(),
    colors: Array.from(new Set(variations.map((v) => v.color))).sort(),
    brands: products.map((p) => p.brand).filter((b): b is string => !!b).sort(),
  };
}
```

- [ ] **Step 2: Criar a página de catálogo**

Create `src/app/(loja)/produtos/page.tsx`. Nota: neste projeto (Next.js 16), `searchParams` de página é uma `Promise` (mesma mudança de API já confirmada para `params` no Plano 1/2) — se isso tiver mudado de novo, verificar `node_modules/next/dist/docs/` antes de forçar o código abaixo.

```tsx
import { prisma } from "@/lib/prisma";
import { getFilteredProducts, getFilterOptions, type ProductFilters } from "@/lib/catalog";
import { ProductCard } from "../_components/ProductCard";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters: ProductFilters = {
    size: params.tamanho || undefined,
    color: params.cor || undefined,
    brand: params.marca || undefined,
    sort: (params.ordenar as ProductFilters["sort"]) || undefined,
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
        <select name="tamanho" defaultValue={params.tamanho ?? ""}>
          <option value="">Todos os tamanhos</option>
          {options.sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="cor" defaultValue={params.cor ?? ""}>
          <option value="">Todas as cores</option>
          {options.colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="marca" defaultValue={params.marca ?? ""}>
          <option value="">Todas as marcas</option>
          {options.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select name="ordenar" defaultValue={params.ordenar ?? ""}>
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
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`. Acessar `/produtos` — deve listar todos os produtos ativos com variação. Filtrar por tamanho/cor/marca (usando os selects, que recarregam a página via query string — ex: `/produtos?tamanho=M`) e confirmar que a lista muda corretamente. Testar "Menor preço" e "Maior preço" na ordenação.

- [ ] **Step 4: Commit**

```bash
git add src/lib/catalog.ts src/app/\(loja\)/produtos
git commit -m "feat: add product catalog page with filters and sorting"
```

---

### Task 3: Listagem por categoria (`/produtos/[categoria]`)

**Files:**
- Create: `src/app/(loja)/produtos/[categoria]/page.tsx`

**Interfaces:**
- Consumes: `getFilteredProducts`, `getFilterOptions`, `ProductFilters` de `src/lib/catalog.ts` (Task 2), `ProductCard` de `src/app/(loja)/_components/ProductCard.tsx` (Task 1), `prisma` de `src/lib/prisma.ts`

- [ ] **Step 1: Criar a página de categoria**

Create `src/app/(loja)/produtos/[categoria]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getFilteredProducts, getFilterOptions, type ProductFilters } from "@/lib/catalog";
import { ProductCard } from "../../_components/ProductCard";

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { categoria } = await params;
  const search = await searchParams;

  const category = await prisma.category.findUnique({ where: { slug: categoria } });
  if (!category) {
    notFound();
  }

  const filters: ProductFilters = {
    categorySlug: categoria,
    size: search.tamanho || undefined,
    color: search.cor || undefined,
    brand: search.marca || undefined,
    sort: (search.ordenar as ProductFilters["sort"]) || undefined,
  };

  const [products, options, settings] = await Promise.all([
    getFilteredProducts(filters),
    getFilterOptions(),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);
  const pixDiscountPercent = settings?.pixDiscountPercent ?? 0;

  return (
    <div>
      <h1>{category.name}</h1>
      <form method="get">
        <select name="tamanho" defaultValue={search.tamanho ?? ""}>
          <option value="">Todos os tamanhos</option>
          {options.sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="cor" defaultValue={search.cor ?? ""}>
          <option value="">Todas as cores</option>
          {options.colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="ordenar" defaultValue={search.ordenar ?? ""}>
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
      {products.length === 0 && <p>Nenhum produto encontrado nesta categoria.</p>}
    </div>
  );
}
```

Nota: `getFilteredProducts`'s `where.category` filtra por `{ slug: filters.categorySlug }` — como o schema do `Category` permite subcategorias (`parentId`), isso filtra só produtos vinculados exatamente àquela categoria, não às subcategorias dela. Isso é intencional pro escopo desta task (comportamento de subcategoria fica pra quando houver demanda real — YAGNI).

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`. Da home, clicar numa categoria (ex: "Camisetas") — deve ir para `/produtos/camisetas` e mostrar só produtos daquela categoria. Acessar uma categoria inexistente (ex: `/produtos/categoria-que-nao-existe`) — deve dar 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(loja\)/produtos/\[categoria\]
git commit -m "feat: add category-filtered product listing page"
```

---

### Task 4: Página de produto (galeria, variações, preço, Pix, parcelamento)

**Files:**
- Create: `src/app/(loja)/produto/[slug]/page.tsx`
- Create: `src/app/(loja)/produto/[slug]/VariationSelector.tsx`

**Interfaces:**
- Consumes: `centsToReais`, `applyPixDiscount` de `src/lib/money.ts` (Task 1), `prisma` de `src/lib/prisma.ts`

- [ ] **Step 1: Criar o seletor de variação (client component)**

Create `src/app/(loja)/produto/[slug]/VariationSelector.tsx`:
```tsx
"use client";

import { useState } from "react";
import { centsToReais, applyPixDiscount } from "@/lib/money";

type Variation = {
  id: string;
  size: string;
  color: string;
  priceCents: number;
  stock: number;
};

export function VariationSelector({
  variations,
  pixDiscountPercent,
  maxInstallments,
}: {
  variations: Variation[];
  pixDiscountPercent: number;
  maxInstallments: number;
}) {
  const firstInStock = variations.find((v) => v.stock > 0) ?? variations[0];
  const [selectedId, setSelectedId] = useState(firstInStock.id);
  const selected = variations.find((v) => v.id === selectedId)!;

  const pixPriceCents = applyPixDiscount(selected.priceCents, pixDiscountPercent);
  const installmentCents = Math.round(selected.priceCents / maxInstallments);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {variations.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setSelectedId(v.id)}
            disabled={v.stock === 0}
            style={{
              border: v.id === selectedId ? "2px solid black" : "1px solid #ccc",
              opacity: v.stock === 0 ? 0.4 : 1,
              padding: "4px 8px",
              background: "white",
            }}
          >
            {v.size} - {v.color}
            {v.stock === 0 ? " (esgotado)" : ""}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 24, fontWeight: "bold" }}>R$ {centsToReais(selected.priceCents)}</p>
      <p>
        ou R$ {centsToReais(pixPriceCents)} no Pix ({pixDiscountPercent}% OFF)
      </p>
      <p>
        ou {maxInstallments}x de R$ {centsToReais(installmentCents)} sem juros
      </p>
      <p>{selected.stock > 0 ? `${selected.stock} em estoque` : "Esgotado nessa variação"}</p>
    </div>
  );
}
```

- [ ] **Step 2: Criar a página de produto**

Create `src/app/(loja)/produto/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VariationSelector } from "./VariationSelector";

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
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`. Acessar a página de um produto real (via `/produtos` ou pela home) — deve mostrar nome, categoria, marca (se tiver), imagens (ou "Sem imagem"), e o seletor de variação com o preço, desconto Pix e parcelamento certos. Clicar em outra variação (tamanho/cor diferente) deve atualizar o preço/estoque mostrado sem recarregar a página. Se a variação selecionada tiver estoque 0, deve aparecer "Esgotado nessa variação". Acessar `/produto/slug-que-nao-existe` deve dar 404. Se possível, desativar um produto pelo admin (`/admin/produtos/[id]`, desmarcar "Ativo") e confirmar que a página pública dele também passa a dar 404.

- [ ] **Step 4: Rodar a suíte de testes completa e o build de produção**

Run: `npm test`
Expected: PASS (13 testes)

Run: `npm run build`
Expected: build completa sem erros, incluindo as novas rotas (`/`, `/produtos`, `/produtos/[categoria]`, `/produto/[slug]`)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(loja\)/produto
git commit -m "feat: add product detail page with variation selector"
```

## Definição de pronto (Plano 3)

- [ ] `npm run dev` sobe sem erros
- [ ] `npm run build` completa sem erros
- [ ] `npm test` passa (13 testes)
- [ ] Home mostra produtos recentes e categorias
- [ ] `/produtos` lista todos os produtos ativos-com-variação, com filtros de tamanho/cor/marca e ordenação por preço funcionando
- [ ] `/produtos/[categoria]` mostra só produtos daquela categoria; categoria inexistente dá 404
- [ ] `/produto/[slug]` mostra a página completa do produto, seletor de variação funcional, e dá 404 pra produto inexistente, inativo, ou sem variações
- [ ] Nenhum produto inativo ou sem variação aparece em nenhuma página pública
- [ ] Nenhum arquivo `.env.example` foi criado
