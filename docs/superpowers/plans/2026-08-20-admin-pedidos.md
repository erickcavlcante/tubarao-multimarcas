# Admin: Pedidos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono da loja abre `/admin/pedidos`, vê os pedidos que entraram, abre um pedido, marca como pago (dando baixa no estoque com segurança), e avança o status até entregue — ou cancela, devolvendo as peças ao estoque quando for o caso.

**Architecture:** Páginas de servidor lendo direto do Prisma, com Server Actions para as transições de status. A regra de quais transições são permitidas vive numa função pura testada (`src/lib/order-status.ts`). A baixa de estoque acontece dentro de uma transação, com *compare-and-swap* no status para garantir que marcar como pago duas vezes não baixe estoque duas vezes.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7

**Spec:** `docs/superpowers/specs/2026-08-18-ecommerce-v1-design.md`

## Escopo: o que NÃO entra

- **Geração de etiqueta do Melhor Envio** — o plano de frete está pausado esperando o token. O modelo `Shipment` já existe no schema; esta plano não o toca.
- **Webhook do Mercado Pago** — plano posterior. O "marcar como pago" manual construído aqui é justamente o que permite exercitar o ciclo antes disso existir, e continua útil depois (transferência bancária, webhook que falhou).
- **Emails ao cliente** — nenhum email é enviado em nenhuma transição. Fica pra depois.

## Global Constraints

- Sempre usar o singleton `src/lib/prisma.ts`, nunca instanciar `PrismaClient`.
- **Toda Server Action de mutação no admin chama `await requireAdmin()` como primeira linha** (de `src/lib/require-admin.ts`) — o endpoint da action é alcançável independente do gate da página.
- **Nunca usar `as unknown as ShippingAddress`.** Existe `readShippingAddress()` em `src/lib/address.ts` (criado no plano de checkout exatamente para isto) — ele valida e devolve `null` para um JSON malformado. Toda página que mostrar endereço usa ele e trata o `null`.
- Dinheiro em centavos, nunca float. Usar `centsToReais` de `src/lib/money.ts`.
- **Toda listagem tem `orderBy` explícito** — sem isso a ordem das linhas fica por conta do Postgres.
- **Nunca criar nem commitar `.env.example`.**
- `AGENTS.md` na raiz e `node_modules/next/dist/docs/` são **reais** — não descartar se algo não compilar como esperado.

## As regras de estoque (leitura obrigatória antes da Task 4)

Registradas na revisão final do plano de checkout, e o motivo de a Task 4 existir separada:

1. **Baixa condicional, nunca incondicional.** `ProductVariation.stock` é `Int` sem CHECK constraint no banco — um `update({ data: { stock: { decrement: n } } })` é atômico na linha mas grava `-1` alegremente. Usar `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` e conferir o `count` retornado.
2. **Faltou estoque não é erro fatal.** O status `PAID_STOCK_ISSUE` já existe no enum para isso: o dinheiro é real, a peça não, o dono resolve na mão. Não abortar a transação, não recusar o pagamento.
3. **Idempotência dentro da transação.** Marcar pago duas vezes não pode baixar estoque duas vezes. Checar o status *antes* da transação é corrida — dois cliques simultâneos leriam `AWAITING_PAYMENT` e ambos seguiriam. A garantia vem de um `updateMany` condicional que só uma chamada consegue vencer.

---

### Task 1: Regras de transição de status (com testes)

**Files:**
- Create: `src/lib/order-status.ts`
- Test: `src/lib/order-status.test.ts`

**Interfaces:**
- Produces: `type OrderStatusValue`, `ORDER_STATUS_LABELS: Record<OrderStatusValue, string>`, `allowedTransitions(from: OrderStatusValue): OrderStatusValue[]`, `canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean`, `restoresStockOnCancel(from: OrderStatusValue): boolean`

- [ ] **Step 1: Escrever os testes (devem falhar)**

Create `src/lib/order-status.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  allowedTransitions,
  canTransition,
  restoresStockOnCancel,
  ORDER_STATUS_LABELS,
} from "./order-status";

describe("allowedTransitions", () => {
  it("lets an awaiting-payment order be paid or canceled", () => {
    expect(allowedTransitions("AWAITING_PAYMENT").sort()).toEqual(["CANCELED", "PAID"]);
  });

  it("lets a paid order be shipped or canceled", () => {
    expect(allowedTransitions("PAID").sort()).toEqual(["CANCELED", "SHIPPED"]);
  });

  it("lets an order with a stock issue be shipped or canceled", () => {
    expect(allowedTransitions("PAID_STOCK_ISSUE").sort()).toEqual(["CANCELED", "SHIPPED"]);
  });

  it("lets a shipped order only be marked delivered", () => {
    expect(allowedTransitions("SHIPPED")).toEqual(["DELIVERED"]);
  });

  it("treats delivered and canceled as final", () => {
    expect(allowedTransitions("DELIVERED")).toEqual([]);
    expect(allowedTransitions("CANCELED")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("accepts a permitted transition", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("rejects going backwards", () => {
    expect(canTransition("SHIPPED", "PAID")).toBe(false);
    expect(canTransition("DELIVERED", "SHIPPED")).toBe(false);
  });

  it("rejects skipping the payment step", () => {
    expect(canTransition("AWAITING_PAYMENT", "SHIPPED")).toBe(false);
  });

  it("rejects any transition out of a final status", () => {
    expect(canTransition("CANCELED", "PAID")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELED")).toBe(false);
  });

  it("rejects a transition to itself", () => {
    expect(canTransition("PAID", "PAID")).toBe(false);
  });

  it("rejects canceling something already shipped", () => {
    expect(canTransition("SHIPPED", "CANCELED")).toBe(false);
  });
});

describe("restoresStockOnCancel", () => {
  it("restores stock when canceling a paid order", () => {
    expect(restoresStockOnCancel("PAID")).toBe(true);
  });

  it("does not restore when nothing was ever decremented", () => {
    expect(restoresStockOnCancel("AWAITING_PAYMENT")).toBe(false);
  });

  it("does not auto-restore an order flagged with a stock issue", () => {
    expect(restoresStockOnCancel("PAID_STOCK_ISSUE")).toBe(false);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("has a label for every status", () => {
    for (const status of [
      "AWAITING_PAYMENT",
      "PAID",
      "PAID_STOCK_ISSUE",
      "SHIPPED",
      "DELIVERED",
      "CANCELED",
    ] as const) {
      expect(typeof ORDER_STATUS_LABELS[status]).toBe("string");
      expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test`
Expected: FAIL — `src/lib/order-status.ts` não existe

- [ ] **Step 3: Implementar**

Create `src/lib/order-status.ts`:
```typescript
export type OrderStatusValue =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PAID_STOCK_ISSUE"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PAID_STOCK_ISSUE: "Pago — problema de estoque",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  AWAITING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["SHIPPED", "CANCELED"],
  PAID_STOCK_ISSUE: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};

export function allowedTransitions(from: OrderStatusValue): OrderStatusValue[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return allowedTransitions(from).includes(to);
}

export function restoresStockOnCancel(from: OrderStatusValue): boolean {
  return from === "PAID";
}
```

Notas de projeto embutidas nessas regras:
- **`SHIPPED` não pode ser cancelado.** A encomenda já saiu; desfazer isso é uma devolução, que é um processo diferente e não existe neste sistema. Melhor não oferecer um botão que mente.
- **`PAID_STOCK_ISSUE` não devolve estoque no cancelamento.** Nesse estado, parte dos itens baixou e parte não — devolver tudo inflaria o estoque. O status existe justamente porque precisa de olho humano; o dono ajusta o estoque na mão pelo `/admin/produtos`.

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npm test`
Expected: PASS — 57 anteriores + os novos

- [ ] **Step 5: Commit**

```bash
git add src/lib/order-status.ts src/lib/order-status.test.ts
git commit -m "feat: add order status transition rules"
```

---

### Task 2: Listagem de pedidos

**Files:**
- Create: `src/app/admin/pedidos/page.tsx`
- Modify: `src/app/admin/layout.tsx` (link na nav)
- Modify: `src/app/admin/page.tsx` (link no dashboard)

**Interfaces:**
- Consumes: `prisma`, `centsToReais` de `src/lib/money.ts`, `ORDER_STATUS_LABELS` de `src/lib/order-status.ts` (Task 1)

- [ ] **Step 1: Criar a listagem**

Create `src/app/admin/pedidos/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "AWAITING_PAYMENT", label: "Aguardando pagamento" },
  { value: "PAID", label: "Pago" },
  { value: "PAID_STOCK_ISSUE", label: "Problema de estoque" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELED", label: "Cancelado" },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const validStatus = STATUS_FILTERS.some((f) => f.value === rawStatus && f.value !== "")
    ? (rawStatus as OrderStatusValue)
    : undefined;

  const orders = await prisma.order.findMany({
    where: validStatus ? { status: validStatus } : undefined,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Pedidos</h1>

      <form method="get">
        <label>
          Status:{" "}
          <select name="status" defaultValue={validStatus ?? ""}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Data</th>
            <th>Cliente</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>#{order.number}</td>
              <td>{order.createdAt.toLocaleDateString("pt-BR")}</td>
              <td>{order.contactEmail}</td>
              <td>{order.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
              <td>R$ {centsToReais(order.totalCents)}</td>
              <td>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</td>
              <td>
                <Link href={`/admin/pedidos/${order.id}`}>Ver</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p>Nenhum pedido encontrado.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Linkar no admin**

Modify `src/app/admin/layout.tsx` — adicionar `<Link href="/admin/pedidos">Pedidos</Link>` junto dos links de nav já existentes, no mesmo estilo.

Modify `src/app/admin/page.tsx` — adicionar um item na lista de links do dashboard apontando pra `/admin/pedidos`, no mesmo formato dos outros.

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`. Fazer um pedido de verdade pela loja (carrinho → checkout → finalizar) e depois acessar `/admin/pedidos` logado como admin — o pedido deve aparecer com número, data, email, quantidade de itens, total e status "Aguardando pagamento". Filtrar por "Pago" — a lista deve ficar vazia. Filtrar por "Aguardando pagamento" — o pedido deve voltar. Passar um status inválido na URL à mão (`/admin/pedidos?status=INVENTADO`) — deve mostrar todos, sem quebrar.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/pedidos src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin order list with status filter"
```

---

### Task 3: Detalhe do pedido (somente leitura)

**Files:**
- Create: `src/app/admin/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma`, `centsToReais`, `ORDER_STATUS_LABELS` (Task 1), `readShippingAddress` de `src/lib/address.ts`

- [ ] **Step 1: Criar a página**

Create `src/app/admin/pedidos/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";
import { readShippingAddress } from "@/lib/address";

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { variation: { include: { product: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const address = readShippingAddress(order.shippingAddress);

  return (
    <div>
      <p>
        <Link href="/admin/pedidos">← Voltar para pedidos</Link>
      </p>
      <h1>Pedido #{order.number}</h1>
      <p>
        Status: <strong>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</strong>
      </p>
      <p>Feito em {order.createdAt.toLocaleString("pt-BR")}</p>
      <p>Cliente: {order.contactEmail}</p>

      <h2>Itens</h2>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Variação</th>
            <th>SKU</th>
            <th>Qtd</th>
            <th>Preço unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.variation.product.name}</td>
              <td>
                {item.variation.size} - {item.variation.color}
              </td>
              <td>{item.variation.sku}</td>
              <td>{item.quantity}</td>
              <td>R$ {centsToReais(item.priceCents)}</td>
              <td>R$ {centsToReais(item.priceCents * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Entrega</h2>
      {address ? (
        <p>
          {address.recipientName}
          <br />
          {address.street}, {address.number}
          {address.complement ? ` - ${address.complement}` : ""}
          <br />
          {address.neighborhood} - {address.city}/{address.state}
          <br />
          CEP {address.zipCode}
        </p>
      ) : (
        <p>Endereço indisponível (dado inválido no pedido).</p>
      )}

      <h2>Valores</h2>
      <p>Subtotal: R$ {centsToReais(order.totalCents - order.shippingCents)}</p>
      <p>
        Frete:{" "}
        {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}
      </p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`. Em `/admin/pedidos`, clicar em "Ver" no pedido — deve mostrar número, status, data, email, a tabela de itens com SKU e preços, o endereço formatado e os valores. Acessar `/admin/pedidos/id-que-nao-existe` deve dar 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/pedidos/\[id\]
git commit -m "feat: add admin order detail page"
```

---

### Task 4: Marcar como pago, com baixa de estoque segura

**Files:**
- Create: `src/app/admin/pedidos/actions.ts`
- Create: `src/app/admin/pedidos/[id]/MarkAsPaidButton.tsx`
- Modify: `src/app/admin/pedidos/[id]/page.tsx` (renderizar o botão)

**Interfaces:**
- Consumes: `prisma`, `requireAdmin`
- Produces: `type OrderActionState = { error?: string; message?: string } | undefined`, `markAsPaid(prevState, formData): Promise<OrderActionState>`

**Releia "As regras de estoque" no topo deste plano antes de implementar.** As três regras estão codificadas no código abaixo e nenhuma delas é opcional.

- [ ] **Step 1: Escrever a action**

Create `src/app/admin/pedidos/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath } from "next/cache";

export type OrderActionState = { error?: string; message?: string } | undefined;

export async function markAsPaid(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) {
    return { error: "Pedido não informado" };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Compare-and-swap: só uma chamada consegue tirar o pedido de
    // AWAITING_PAYMENT. Ler o status e depois gravar seria corrida — dois
    // cliques simultâneos leriam "aguardando" e ambos baixariam estoque.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "AWAITING_PAYMENT" },
      data: { status: "PAID" },
    });

    if (claimed.count === 0) {
      return { error: "Este pedido não está mais aguardando pagamento" };
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });

    const shortages: string[] = [];
    for (const item of items) {
      // Baixa condicional: o `where` com `stock: { gte: quantity }` garante
      // que a linha só é atualizada se houver estoque suficiente. Um
      // decrement sem essa condição gravaria estoque negativo.
      const decremented = await tx.productVariation.updateMany({
        where: { id: item.variationId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (decremented.count === 0) {
        const variation = await tx.productVariation.findUnique({
          where: { id: item.variationId },
          include: { product: true },
        });
        shortages.push(
          variation
            ? `${variation.product.name} (${variation.size} - ${variation.color}): pedido ${item.quantity}, em estoque ${variation.stock}`
            : `variação ${item.variationId} não encontrada`
        );
      }
    }

    if (shortages.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID_STOCK_ISSUE" },
      });
      return {
        message: `Pedido marcado como pago, mas faltou estoque: ${shortages.join("; ")}. Ajuste o estoque e trate o pedido manualmente.`,
      };
    }

    return { message: "Pedido marcado como pago e estoque baixado." };
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return result;
}
```

- [ ] **Step 2: Criar o botão**

Create `src/app/admin/pedidos/[id]/MarkAsPaidButton.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { markAsPaid, type OrderActionState } from "../actions";

export function MarkAsPaidButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    markAsPaid,
    undefined
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" disabled={pending}>
          {pending ? "Processando..." : "Marcar como pago (baixa o estoque)"}
        </button>
      </form>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
      {state?.message && <p style={{ color: "#166534" }}>{state.message}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Renderizar o botão no detalhe**

Modify `src/app/admin/pedidos/[id]/page.tsx`:

1. Adicionar ao topo: `import { MarkAsPaidButton } from "./MarkAsPaidButton";`
2. Depois do bloco `<h2>Valores</h2>` e seus parágrafos, adicionar:
```tsx
      {order.status === "AWAITING_PAYMENT" && (
        <>
          <h2>Ações</h2>
          <MarkAsPaidButton orderId={order.id} />
        </>
      )}
```

- [ ] **Step 4: Verificar manualmente — inclusive os casos difíceis**

Run: `npm run dev`.

1. **Caminho feliz:** anotar o estoque atual de uma variação. Fazer um pedido dela pela loja. No admin, abrir o pedido e clicar em "Marcar como pago" — deve mostrar a mensagem de sucesso, o status virar "Pago", e o estoque daquela variação ter baixado exatamente a quantidade comprada (conferir em `/admin/produtos/[id]`).
2. **Idempotência:** com o pedido já pago, recarregar a página — o botão não deve mais aparecer. Reenviar a action à mão (ex: um POST direto, ou reabrir uma aba antiga que ainda mostrava o botão e clicar) — deve retornar "Este pedido não está mais aguardando pagamento" e **o estoque não pode baixar de novo**. Conferir o estoque antes e depois.
3. **Falta de estoque:** fazer um novo pedido, depois reduzir o estoque daquela variação para menos que a quantidade pedida (pelo `/admin/produtos/[id]`), e então marcar como pago — o status deve virar "Pago — problema de estoque", a mensagem deve nomear o produto e as quantidades, e **o estoque não pode ficar negativo**. Conferir o valor exato do estoque depois.

Restaurar os dados de teste ao final e registrar no relatório o que foi mexido.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/pedidos
git commit -m "feat: add mark-as-paid with conditional stock decrement"
```

---

### Task 5: Demais transições de status

**Files:**
- Modify: `src/app/admin/pedidos/actions.ts` (adicionar `changeStatus`)
- Create: `src/app/admin/pedidos/[id]/StatusActions.tsx`
- Modify: `src/app/admin/pedidos/[id]/page.tsx` (renderizar as ações)

**Interfaces:**
- Consumes: `canTransition`, `restoresStockOnCancel`, `ORDER_STATUS_LABELS`, `OrderStatusValue` de `src/lib/order-status.ts` (Task 1)
- Produces: `changeStatus(prevState, formData): Promise<OrderActionState>`

- [ ] **Step 1: Adicionar a action**

Modify `src/app/admin/pedidos/actions.ts` — adicionar ao topo, junto dos imports existentes:
```typescript
import {
  canTransition,
  restoresStockOnCancel,
  type OrderStatusValue,
} from "@/lib/order-status";
```

E adicionar ao final do arquivo (mantendo `markAsPaid` como está):
```typescript
export async function changeStatus(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const target = String(formData.get("status") ?? "") as OrderStatusValue;
  if (!orderId || !target) {
    return { error: "Dados incompletos" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { error: "Pedido não encontrado" };
    }

    const current = order.status as OrderStatusValue;
    if (!canTransition(current, target)) {
      return { error: "Essa mudança de status não é permitida" };
    }

    // Mesmo compare-and-swap do markAsPaid: garante que a transição só
    // acontece a partir do status que acabamos de validar.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: current },
      data: { status: target },
    });

    if (claimed.count === 0) {
      return { error: "O pedido mudou de status enquanto você agia. Recarregue a página." };
    }

    if (target === "CANCELED" && restoresStockOnCancel(current)) {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.productVariation.update({
          where: { id: item.variationId },
          data: { stock: { increment: item.quantity } },
        });
      }
      return { message: "Pedido cancelado e estoque devolvido." };
    }

    if (target === "CANCELED" && current === "PAID_STOCK_ISSUE") {
      return {
        message:
          "Pedido cancelado. O estoque NÃO foi devolvido automaticamente porque este pedido tinha problema de estoque — confira e ajuste manualmente.",
      };
    }

    return { message: "Status atualizado." };
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return result;
}
```

- [ ] **Step 2: Criar os botões de status**

Create `src/app/admin/pedidos/[id]/StatusActions.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { changeStatus, type OrderActionState } from "../actions";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

export function StatusActions({
  orderId,
  targets,
}: {
  orderId: string;
  targets: OrderStatusValue[];
}) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    changeStatus,
    undefined
  );

  if (targets.length === 0) {
    return <p>Este pedido está finalizado — nenhuma ação disponível.</p>;
  }

  return (
    <div>
      {targets.map((target) => (
        <form key={target} action={formAction} style={{ display: "inline" }}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={target} />
          <button type="submit" disabled={pending} style={{ marginRight: 8 }}>
            Marcar como {ORDER_STATUS_LABELS[target].toLowerCase()}
          </button>
        </form>
      ))}
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
      {state?.message && <p style={{ color: "#166534" }}>{state.message}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Renderizar no detalhe**

Modify `src/app/admin/pedidos/[id]/page.tsx`:

1. Adicionar aos imports: `import { StatusActions } from "./StatusActions";` e incluir `allowedTransitions` no import já existente de `@/lib/order-status`.
2. Substituir o bloco de ações da Task 4 por:
```tsx
      <h2>Ações</h2>
      {order.status === "AWAITING_PAYMENT" && <MarkAsPaidButton orderId={order.id} />}
      <StatusActions
        orderId={order.id}
        targets={allowedTransitions(order.status as OrderStatusValue).filter(
          (t) => !(order.status === "AWAITING_PAYMENT" && t === "PAID")
        )}
      />
```

O `filter` evita mostrar dois botões que fazem a mesma coisa: quando o pedido está aguardando pagamento, quem faz a transição pra "Pago" é o `MarkAsPaidButton` (que baixa estoque), não o botão genérico.

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`.

1. Pedido pago → clicar em "Marcar como enviado" → status vira "Enviado", e as ações disponíveis passam a ser só "Marcar como entregue".
2. Pedido enviado → "Marcar como entregue" → status vira "Entregue" e a tela diz que não há mais ações.
3. **Cancelamento com devolução de estoque:** anotar o estoque, fazer um pedido, marcar como pago (estoque baixa), depois cancelar — a mensagem deve dizer que o estoque foi devolvido, e o estoque deve voltar exatamente ao valor original.
4. **Transição inválida:** com um pedido entregue, forçar um POST da action pedindo `SHIPPED` — deve retornar "Essa mudança de status não é permitida" e o status não pode mudar.

Restaurar os dados de teste e registrar no relatório.

- [ ] **Step 5: Rodar testes e build**

Run: `npm test` — Expected: PASS
Run: `npm run build` — Expected: build limpo

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/pedidos
git commit -m "feat: add order status transitions with stock restore on cancel"
```

---

### Task 6: Dashboard do admin

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `prisma`, `centsToReais`, `ORDER_STATUS_LABELS` (Task 1)

O spec pede que o dashboard mostre "pedidos recentes, alertas de estoque baixo". Hoje é só um texto de boas-vindas com links.

- [ ] **Step 1: Reescrever o dashboard**

Modify `src/app/admin/page.tsx` — substituir o conteúdo do componente por:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

const LOW_STOCK_THRESHOLD = 3;

export default async function AdminDashboardPage() {
  const [recentOrders, awaitingCount, lowStock] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    prisma.productVariation.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { active: true } },
      include: { product: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <h1>Dashboard</h1>

      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/produtos">Produtos</Link>
        <Link href="/admin/categorias">Categorias</Link>
        <Link href="/admin/configuracoes">Configurações</Link>
      </nav>

      {awaitingCount > 0 && (
        <p style={{ background: "#fef3c7", padding: 8 }}>
          {awaitingCount} pedido(s) aguardando pagamento.{" "}
          <Link href="/admin/pedidos?status=AWAITING_PAYMENT">Ver</Link>
        </p>
      )}

      <h2>Pedidos recentes</h2>
      {recentOrders.length === 0 ? (
        <p>Nenhum pedido ainda.</p>
      ) : (
        <ul>
          {recentOrders.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/pedidos/${order.id}`}>#{order.number}</Link> —{" "}
              {order.createdAt.toLocaleDateString("pt-BR")} — R$ {centsToReais(order.totalCents)} —{" "}
              {ORDER_STATUS_LABELS[order.status as OrderStatusValue]}
            </li>
          ))}
        </ul>
      )}

      <h2>Estoque baixo (até {LOW_STOCK_THRESHOLD} unidades)</h2>
      {lowStock.length === 0 ? (
        <p>Nenhuma variação com estoque baixo.</p>
      ) : (
        <ul>
          {lowStock.map((variation) => (
            <li key={variation.id}>
              <Link href={`/admin/produtos/${variation.productId}`}>
                {variation.product.name}
              </Link>{" "}
              ({variation.size} - {variation.color}): {variation.stock} em estoque
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Nota: o `<nav>` acima substitui a lista de links que a página tinha antes — não deixar as duas.

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`. Acessar `/admin` — deve mostrar os pedidos recentes (com link funcionando), o aviso amarelo se houver pedido aguardando pagamento (e o link levando à lista já filtrada), e a lista de variações com estoque baixo. Zerar o estoque de uma variação pelo `/admin/produtos/[id]` e recarregar o dashboard — ela deve aparecer no alerta. Restaurar depois.

- [ ] **Step 3: Rodar testes e build**

Run: `npm test` — Expected: PASS
Run: `npm run build` — Expected: build limpo

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add admin dashboard with recent orders and low stock alerts"
```

## Definição de pronto (Plano Admin: Pedidos)

- [ ] `npm run dev` e `npm run build` limpos
- [ ] `npm test` passa (57 anteriores + os novos de transição de status)
- [ ] `/admin/pedidos` lista pedidos com filtro por status funcionando; status inválido na URL não quebra
- [ ] `/admin/pedidos/[id]` mostra itens, endereço (via `readShippingAddress`, com fallback pra dado inválido) e valores; id inexistente dá 404
- [ ] **"Marcar como pago" baixa o estoque corretamente, e o estoque NUNCA fica negativo**
- [ ] **Marcar como pago duas vezes não baixa estoque duas vezes** — verificado com o estoque conferido antes e depois
- [ ] Estoque insuficiente vira `PAID_STOCK_ISSUE` com mensagem nomeando produto e quantidades, sem abortar
- [ ] Cancelar um pedido pago devolve o estoque exatamente; cancelar um `PAID_STOCK_ISSUE` avisa que não devolveu
- [ ] Transições inválidas são rejeitadas mesmo se forçadas por POST direto
- [ ] Dashboard mostra pedidos recentes, aviso de pedidos aguardando pagamento e alerta de estoque baixo
- [ ] Nenhum arquivo `.env.example` foi criado
