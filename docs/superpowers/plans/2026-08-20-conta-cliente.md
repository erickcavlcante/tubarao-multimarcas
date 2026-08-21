# Conta do Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente cria uma conta, entra, vê seus dados, salva endereços de entrega, acompanha seus pedidos, e no checkout escolhe um endereço salvo em vez de digitar tudo de novo — com o pedido ficando ligado à conta dele.

**Architecture:** Reaproveita o NextAuth já configurado (Credentials + JWT). Uma área `/conta` protegida pelo mesmo `src/proxy.ts` que já protege `/admin`, com um `requireUser()` análogo ao `requireAdmin()` para as Server Actions. O checkout passa a preencher `Order.userId` quando há sessão, sem deixar de funcionar para convidado.

**Tech Stack:** Next.js 16 (App Router, Server Actions), NextAuth v5, Prisma 7

**Spec:** `docs/superpowers/specs/2026-08-18-ecommerce-v1-design.md`

## A armadilha de segurança deste plano — leia antes da Task 5

Existe uma tentação óbvia: quando alguém se cadastra, "adotar" os pedidos de convidado feitos com aquele mesmo email, para que apareçam no histórico. **Não faça isso.** Este sistema não verifica email. Qualquer pessoa poderia se cadastrar com `vitima@exemplo.com` e passar a ver os pedidos dela — nome completo, endereço residencial, o que comprou. Seria um vazamento de dados pessoais criado por uma funcionalidade "de conveniência".

Pedidos só aparecem no histórico quando foram feitos **com a sessão logada** (`Order.userId` preenchido no momento da compra). Pedidos de convidado continuam acessíveis apenas por quem tem o link da confirmação, que é o que já acontece hoje. Adotar pedidos antigos por email só passa a ser aceitável depois que existir verificação de email — que não está no escopo.

## Escopo: o que NÃO entra

- **Verificação de email e recuperação de senha ("esqueci minha senha")** — ambas dependem de envio de email, que o sistema ainda não faz. Ficam para quando houver envio de email configurado.
- **Rastreio da encomenda** — o spec cita "status/rastreio" no histórico. O status entra; o código de rastreio vive em `Shipment`, que só é preenchido pelo plano do Melhor Envio (pausado, esperando token). O histórico mostra o rastreio quando existir e omite quando não.
- **Edição de pedido pelo cliente** — cliente não altera nem cancela pedido; isso é do admin.

## Global Constraints

- Sempre usar o singleton `src/lib/prisma.ts`, nunca instanciar `PrismaClient`.
- **Toda Server Action da área do cliente chama `await requireUser()` como primeira linha** e usa o `id` que ela devolve — **nunca um `userId` vindo do formulário**. Um id vindo do cliente é o caminho direto para um cliente mexer nos dados de outro.
- **Toda consulta na área do cliente filtra por `userId` do usuário da sessão.** Nenhuma query pode retornar linha de outro usuário, nem por id direto — buscar por `id` sozinho e depois comparar o dono em JavaScript é aceitável só se a comparação existir de fato; preferir sempre `where: { id, userId }`.
- **`isAdmin` NUNCA pode vir de formulário.** O cadastro cria usuário comum, ponto. Não espalhar (`...`) dados de formulário dentro de um `data:` do Prisma.
- Senhas com hash via `hashPassword` de `src/lib/password.ts`, nunca texto puro.
- **Toda rota pública nova precisa de `export const dynamic = "force-dynamic";`.**
- Dinheiro em centavos via `centsToReais`.
- **Nunca criar nem commitar `.env.example`.**
- `AGENTS.md` na raiz e `node_modules/next/dist/docs/` são **reais** — não descartar se algo não compilar como esperado.

---

### Task 1: Validação de cadastro (com testes)

**Files:**
- Create: `src/lib/registration.ts`
- Test: `src/lib/registration.test.ts`

**Interfaces:**
- Produces: `type RegistrationInput = { name: string; email: string; password: string; passwordConfirm: string }`, `validateRegistration(input: RegistrationInput): { data: { name: string; email: string; password: string } } | { error: string }`

- [ ] **Step 1: Escrever os testes (devem falhar)**

Create `src/lib/registration.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateRegistration } from "./registration";

const valid = {
  name: "Erick Cavalcante",
  email: "cliente@exemplo.com",
  password: "senhaforte123",
  passwordConfirm: "senhaforte123",
};

describe("validateRegistration", () => {
  it("accepts a well-formed registration", () => {
    const result = validateRegistration(valid);
    expect("data" in result).toBe(true);
  });

  it("trims the name and lowercases the email", () => {
    const result = validateRegistration({
      ...valid,
      name: "  Erick  ",
      email: "  Cliente@Exemplo.COM ",
    });
    expect("data" in result && result.data.name).toBe("Erick");
    expect("data" in result && result.data.email).toBe("cliente@exemplo.com");
  });

  it("rejects an empty name", () => {
    expect("error" in validateRegistration({ ...valid, name: "   " })).toBe(true);
  });

  it("rejects a malformed email", () => {
    for (const email of ["", "cliente", "cliente@", "@exemplo.com", "a b@c.com"]) {
      expect("error" in validateRegistration({ ...valid, email })).toBe(true);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const short = "1234567";
    expect(
      "error" in validateRegistration({ ...valid, password: short, passwordConfirm: short })
    ).toBe(true);
  });

  it("accepts a password of exactly 8 characters", () => {
    const eight = "12345678";
    expect(
      "data" in validateRegistration({ ...valid, password: eight, passwordConfirm: eight })
    ).toBe(true);
  });

  it("rejects when the confirmation does not match", () => {
    expect(
      "error" in validateRegistration({ ...valid, passwordConfirm: "outraCoisa123" })
    ).toBe(true);
  });

  it("does not trim the password", () => {
    const spaced = "  senha com espaco  ";
    const result = validateRegistration({
      ...valid,
      password: spaced,
      passwordConfirm: spaced,
    });
    expect("data" in result && result.data.password).toBe(spaced);
  });

  it("never returns the confirmation field", () => {
    const result = validateRegistration(valid);
    expect("data" in result && "passwordConfirm" in result.data).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test`
Expected: FAIL — `src/lib/registration.ts` não existe

- [ ] **Step 3: Implementar**

Create `src/lib/registration.ts`:
```typescript
export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export const MIN_PASSWORD_LENGTH = 8;

export function validateRegistration(
  input: RegistrationInput
): { data: { name: string; email: string; password: string } } | { error: string } {
  const name = String(input.name ?? "").trim();
  if (!name) {
    return { error: "Nome é obrigatório" };
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email inválido" };
  }

  const password = String(input.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }

  if (password !== String(input.passwordConfirm ?? "")) {
    return { error: "As senhas não conferem" };
  }

  return { data: { name, email, password } };
}
```

Nota: a senha **não** é trimada — espaços podem fazer parte dela de propósito, e cortar silenciosamente faria o login falhar depois com uma senha que o cliente digitou igual.

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npm test`
Expected: PASS — 69 anteriores + os novos

- [ ] **Step 5: Commit**

```bash
git add src/lib/registration.ts src/lib/registration.test.ts
git commit -m "feat: add customer registration validation"
```

---

### Task 2: Cadastro, `requireUser`, e correção do redirect do login

**Files:**
- Create: `src/lib/require-user.ts`
- Create: `src/app/(loja)/cadastro/actions.ts`
- Create: `src/app/(loja)/cadastro/RegisterForm.tsx`
- Create: `src/app/(loja)/cadastro/page.tsx`
- Modify: `src/app/login/page.tsx` (redirect por papel, em vez de sempre `/admin`)
- Modify: `src/proxy.ts` (proteger `/conta`)

**Interfaces:**
- Consumes: `validateRegistration` de `src/lib/registration.ts` (Task 1), `hashPassword` de `src/lib/password.ts`, `auth` de `src/lib/auth.ts`, `prisma`
- Produces: `requireUser(): Promise<{ id: string; isAdmin: boolean }>` em `src/lib/require-user.ts`
- Produces: `type RegisterState = { error?: string } | undefined`, `registerCustomer(prevState, formData): Promise<RegisterState>`

A página de login existe desde o primeiro plano e **sempre** manda pra `/admin` depois de entrar. Isso está registrado como pendência desde então: assim que existir cliente, ele logaria, seria jogado pro `/admin`, o proxy o devolveria pro login, e pareceria que o login está quebrado. Esta task corrige.

- [ ] **Step 1: Criar o `requireUser`**

Create `src/lib/require-user.ts`:
```typescript
import { auth } from "@/lib/auth";

export async function requireUser(): Promise<{ id: string; isAdmin: boolean }> {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;

  if (!user?.id) {
    throw new Error("Não autorizado");
  }

  return { id: user.id, isAdmin: user.isAdmin ?? false };
}
```

Nota: `authorize()` em `src/lib/auth.ts` já devolve `id`, e o NextAuth o propaga para a sessão por padrão. Se ao verificar a Task 2 o `session.user.id` vier `undefined`, é preciso adicionar `token.id = user.id` no callback `jwt` e `session.user.id = token.id` no callback `session` de `src/lib/auth.ts`, do mesmo jeito que `isAdmin` já é propagado ali. Verificar de fato antes de seguir — o resto do plano depende deste id.

- [ ] **Step 2: Criar a action de cadastro**

Create `src/app/(loja)/cadastro/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { validateRegistration } from "@/lib/registration";
import { hashPassword } from "@/lib/password";

export type RegisterState = { error?: string; ok?: boolean } | undefined;

export async function registerCustomer(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const validated = validateRegistration({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });

  if ("error" in validated) {
    return { error: validated.error };
  }

  const existing = await prisma.user.findUnique({ where: { email: validated.data.email } });
  if (existing) {
    return { error: "Já existe uma conta com esse email" };
  }

  const passwordHash = await hashPassword(validated.data.password);

  // isAdmin NÃO é passado: fica no default `false` do schema. Nunca montar este
  // objeto espalhando dados de formulário.
  await prisma.user.create({
    data: {
      name: validated.data.name,
      email: validated.data.email,
      passwordHash,
    },
  });

  return { ok: true };
}
```

- [ ] **Step 3: Criar o formulário de cadastro**

Create `src/app/(loja)/cadastro/RegisterForm.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerCustomer, type RegisterState } from "./actions";

export function RegisterForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerCustomer,
    undefined
  );
  const [credentials, setCredentials] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!state?.ok) {
      return;
    }
    // Cadastro deu certo: entra automaticamente e leva pra área da conta.
    signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirect: false,
    }).then(() => {
      router.push("/conta");
      router.refresh();
    });
  }, [state?.ok, credentials.email, credentials.password, router]);

  return (
    <form action={formAction}>
      <label>
        Nome: <input type="text" name="name" required />
      </label>
      <label>
        Email:{" "}
        <input
          type="email"
          name="email"
          required
          value={credentials.email}
          onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
        />
      </label>
      <label>
        Senha:{" "}
        <input
          type="password"
          name="password"
          required
          minLength={8}
          value={credentials.password}
          onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
        />
      </label>
      <label>
        Confirme a senha: <input type="password" name="passwordConfirm" required minLength={8} />
      </label>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
      <p>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 4: Criar a página de cadastro**

Create `src/app/(loja)/cadastro/page.tsx`:
```tsx
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default function CadastroPage() {
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Criar conta</h1>
      <RegisterForm />
    </div>
  );
}
```

- [ ] **Step 5: Corrigir o redirect do login**

Modify `src/app/login/page.tsx`:

1. Adicionar `getSession` ao import de `next-auth/react` (que já importa `signIn`), e importar `useSearchParams` de `next/navigation` junto do `useRouter` já existente.
2. Dentro do componente, adicionar `const searchParams = useSearchParams();`
3. Substituir o `router.push("/admin");` do fim do `handleSubmit` por:
```tsx
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl && callbackUrl.startsWith("/")) {
      router.push(callbackUrl);
    } else {
      const session = await getSession();
      const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
      router.push(isAdmin ? "/admin" : "/conta");
    }
    router.refresh();
```

A checagem `callbackUrl.startsWith("/")` é obrigatória: sem ela, `?callbackUrl=https://site-malicioso.com` transformaria a página de login num redirecionador aberto para phishing.

4. Adicionar, abaixo do botão de entrar:
```tsx
        <p>
          Não tem conta? <Link href="/cadastro">Criar conta</Link>
        </p>
```
(importando `Link` de `next/link` no topo)

- [ ] **Step 6: Proteger `/conta` no proxy**

Modify `src/proxy.ts`:

1. Adicionar a checagem da área do cliente. O arquivo hoje só trata `/admin`; passa a tratar os dois:
```typescript
export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const user = req.auth?.user as { isAdmin?: boolean } | undefined;

  if (pathname.startsWith("/admin") && !user?.isAdmin) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (pathname.startsWith("/conta") && !req.auth) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
});
```

2. Ampliar o matcher:
```typescript
export const config = {
  matcher: ["/admin/:path*", "/conta/:path*"],
};
```

Ler o arquivo atual antes de editar — a estrutura pode diferir do trecho acima; preservar o que já funciona para `/admin` e apenas acrescentar `/conta`.

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev`.

1. Acessar `/conta` deslogado — deve mandar pro login com `?callbackUrl=/conta` na URL.
2. Criar uma conta em `/cadastro` — deve entrar automaticamente e cair em `/conta` (que ainda dá 404 até a Task 3 — esperado).
3. Sair, e entrar pelo `/login` com essa conta de cliente — deve ir pra `/conta`, **não** pra `/admin`.
4. Entrar com a conta do admin — deve ir pra `/admin` como antes.
5. Acessar `/conta` deslogado, logar na tela que aparecer — deve voltar pra `/conta` (o `callbackUrl` funcionando).
6. Tentar `/login?callbackUrl=https://exemplo.com` e logar — **não** pode sair do site; deve cair no destino normal por papel.
7. Tentar cadastrar com o email do admin — deve dar "Já existe uma conta com esse email".
8. Confirmar no banco que o usuário criado tem `isAdmin = false`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/require-user.ts src/app/\(loja\)/cadastro src/app/login/page.tsx src/proxy.ts
git commit -m "feat: add customer registration and role-aware login redirect"
```

---

### Task 3: Área da conta e dados pessoais

**Files:**
- Create: `src/app/(loja)/conta/layout.tsx`
- Create: `src/app/(loja)/conta/page.tsx`
- Modify: `src/app/(loja)/layout.tsx` (link "Minha conta" no cabeçalho)

**Interfaces:**
- Consumes: `requireUser` de `src/lib/require-user.ts` (Task 2), `prisma`

- [ ] **Step 1: Criar o layout da conta**

Create `src/app/(loja)/conta/layout.tsx`:
```tsx
import Link from "next/link";

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link href="/conta">Meus dados</Link>
        <Link href="/conta/enderecos">Endereços</Link>
        <Link href="/conta/pedidos">Meus pedidos</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Criar a página de dados pessoais**

Create `src/app/(loja)/conta/page.tsx`:
```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const { id } = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, createdAt: true },
  });

  return (
    <div>
      <h1>Meus dados</h1>
      <p>Nome: {user?.name ?? "—"}</p>
      <p>Email: {user?.email}</p>
      <p>Cliente desde {user?.createdAt.toLocaleDateString("pt-BR")}</p>
    </div>
  );
}
```

Nota: o `select` traz só o necessário — nunca `passwordHash`, nem mesmo para não usar. O que não é buscado não pode vazar por acidente.

- [ ] **Step 3: Linkar no cabeçalho da loja**

Modify `src/app/(loja)/layout.tsx` — adicionar `<Link href="/conta">Minha conta</Link>` na `<nav>` do cabeçalho, junto de "Todos os produtos" e do link do carrinho, no mesmo estilo.

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`. Logado como cliente, acessar `/conta` pelo link do cabeçalho — deve mostrar nome, email e a data de criação. Deslogado, o mesmo link deve levar ao login com `callbackUrl`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(loja\)/conta src/app/\(loja\)/layout.tsx
git commit -m "feat: add customer account area with profile page"
```

---

### Task 4: Endereços salvos

**Files:**
- Create: `src/app/(loja)/conta/enderecos/actions.ts`
- Create: `src/app/(loja)/conta/enderecos/AddressManager.tsx`
- Create: `src/app/(loja)/conta/enderecos/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 2), `parseAddress` de `src/lib/address.ts`, `prisma`
- Produces: `type AddressState = { error?: string; ok?: boolean } | undefined`, `addAddress(prevState, formData)`, `deleteAddress(prevState, formData)`

**A regra de propriedade é o ponto crítico desta task:** o `userId` vem sempre de `requireUser()`, nunca do formulário, e a exclusão filtra por `{ id, userId }` — não basta filtrar por `id` e confiar que o endereço é de quem pediu.

- [ ] **Step 1: Criar as actions**

Create `src/app/(loja)/conta/enderecos/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { parseAddress } from "@/lib/address";
import { revalidatePath } from "next/cache";

export type AddressState = { error?: string; ok?: boolean } | undefined;

export async function addAddress(
  _prevState: AddressState,
  formData: FormData
): Promise<AddressState> {
  const { id: userId } = await requireUser();

  const parsed = parseAddress({
    recipientName: String(formData.get("recipientName") ?? ""),
    zipCode: String(formData.get("zipCode") ?? ""),
    street: String(formData.get("street") ?? ""),
    number: String(formData.get("number") ?? ""),
    complement: String(formData.get("complement") ?? ""),
    neighborhood: String(formData.get("neighborhood") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
  });

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const label = String(formData.get("label") ?? "").trim() || null;

  await prisma.address.create({
    // userId vem da sessão, nunca do formulário.
    data: { ...parsed.address, label, userId },
  });

  revalidatePath("/conta/enderecos");
  return { ok: true };
}

export async function deleteAddress(
  _prevState: AddressState,
  formData: FormData
): Promise<AddressState> {
  const { id: userId } = await requireUser();

  const addressId = String(formData.get("addressId") ?? "");
  if (!addressId) {
    return { error: "Endereço não informado" };
  }

  // O filtro por userId é o que impede um cliente de apagar o endereço de outro.
  const deleted = await prisma.address.deleteMany({
    where: { id: addressId, userId },
  });

  if (deleted.count === 0) {
    return { error: "Endereço não encontrado" };
  }

  revalidatePath("/conta/enderecos");
  return { ok: true };
}
```

- [ ] **Step 2: Criar o gerenciador de endereços**

Create `src/app/(loja)/conta/enderecos/AddressManager.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { addAddress, deleteAddress, type AddressState } from "./actions";

type Address = {
  id: string;
  label: string | null;
  recipientName: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

function AddressRow({ address }: { address: Address }) {
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    deleteAddress,
    undefined
  );

  return (
    <li style={{ marginBottom: 12 }}>
      {address.label && <strong>{address.label} — </strong>}
      {address.recipientName}
      <br />
      {address.street}, {address.number}
      {address.complement ? ` - ${address.complement}` : ""}
      <br />
      {address.neighborhood} - {address.city}/{address.state} — CEP {address.zipCode}
      <form action={formAction}>
        <input type="hidden" name="addressId" value={address.id} />
        <button type="submit" disabled={pending}>
          Remover
        </button>
      </form>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
    </li>
  );
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    addAddress,
    undefined
  );

  return (
    <div>
      {addresses.length === 0 ? (
        <p>Você ainda não salvou nenhum endereço.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {addresses.map((address) => (
            <AddressRow key={address.id} address={address} />
          ))}
        </ul>
      )}

      <h2>Adicionar endereço</h2>
      <form action={formAction}>
        <label>
          Apelido (ex: Casa, Trabalho): <input type="text" name="label" />
        </label>
        <label>
          Nome de quem recebe: <input type="text" name="recipientName" required />
        </label>
        <label>
          CEP: <input type="text" name="zipCode" required maxLength={9} />
        </label>
        <label>
          Rua: <input type="text" name="street" required />
        </label>
        <label>
          Número: <input type="text" name="number" required />
        </label>
        <label>
          Complemento: <input type="text" name="complement" />
        </label>
        <label>
          Bairro: <input type="text" name="neighborhood" required />
        </label>
        <label>
          Cidade: <input type="text" name="city" required />
        </label>
        <label>
          Estado (sigla): <input type="text" name="state" required maxLength={2} />
        </label>
        {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
        {state?.ok && <p style={{ color: "#166534" }}>Endereço salvo.</p>}
        <button type="submit" disabled={pending}>
          Salvar endereço
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Criar a página**

Create `src/app/(loja)/conta/enderecos/page.tsx`:
```tsx
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { AddressManager } from "./AddressManager";

export const dynamic = "force-dynamic";

export default async function EnderecosPage() {
  const { id: userId } = await requireUser();

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Meus endereços</h1>
      <AddressManager addresses={addresses} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar manualmente — incluindo o teste de propriedade**

Run: `npm run dev`.

1. Logado como cliente A, salvar dois endereços — devem aparecer na lista com o apelido.
2. Remover um — deve sumir.
3. CEP inválido (7 dígitos) ou estado com 3 letras deve dar erro sem salvar.
4. **Teste de propriedade (o mais importante):** criar uma segunda conta (cliente B), salvar um endereço nela e anotar o `id` desse endereço (pelo banco). Voltar para o cliente A e forçar um POST da action `deleteAddress` com o `addressId` do cliente B. **Deve retornar "Endereço não encontrado" e o endereço do cliente B tem que continuar existindo** — conferir no banco. Se ele sumir, o filtro por `userId` não está funcionando e isso é um vazamento grave.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(loja\)/conta/enderecos
git commit -m "feat: add saved addresses for customers"
```

---

### Task 5: Histórico de pedidos

**Files:**
- Create: `src/app/(loja)/conta/pedidos/page.tsx`
- Create: `src/app/(loja)/conta/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 2), `centsToReais`, `ORDER_STATUS_LABELS` de `src/lib/order-status.ts`, `readShippingAddress` de `src/lib/address.ts`, `prisma`

**Releia "A armadilha de segurança deste plano" no topo antes de implementar.** Nenhum pedido de convidado é adotado por email. Só aparece o que tem `userId` igual ao da sessão.

- [ ] **Step 1: Criar a listagem**

Create `src/app/(loja)/conta/pedidos/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function MeusPedidosPage() {
  const { id: userId } = await requireUser();

  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Meus pedidos</h1>
      {orders.length === 0 ? (
        <p>
          Você ainda não fez nenhum pedido com esta conta. <Link href="/produtos">Ver produtos</Link>
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
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
                <td>{order.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                <td>R$ {centsToReais(order.totalCents)}</td>
                <td>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</td>
                <td>
                  <Link href={`/conta/pedidos/${order.id}`}>Detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar o detalhe**

Create `src/app/(loja)/conta/pedidos/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { centsToReais } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";
import { readShippingAddress } from "@/lib/address";

export const dynamic = "force-dynamic";

export default async function MeuPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { id: userId } = await requireUser();

  // O `userId` no where é o que impede um cliente de abrir o pedido de outro
  // trocando o id na URL. Buscar só por id e comparar depois seria frágil.
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: { include: { variation: { include: { product: true } } }, orderBy: { id: "asc" } },
      shipment: true,
    },
  });

  if (!order) {
    notFound();
  }

  const address = readShippingAddress(order.shippingAddress);

  return (
    <div>
      <p>
        <Link href="/conta/pedidos">← Voltar para meus pedidos</Link>
      </p>
      <h1>Pedido #{order.number}</h1>
      <p>
        Status: <strong>{ORDER_STATUS_LABELS[order.status as OrderStatusValue]}</strong>
      </p>
      <p>Feito em {order.createdAt.toLocaleString("pt-BR")}</p>

      {order.shipment?.trackingCode && (
        <p>
          Código de rastreio: <strong>{order.shipment.trackingCode}</strong>
          {order.shipment.carrier ? ` (${order.shipment.carrier})` : ""}
        </p>
      )}

      <h2>Itens</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}x {item.variation.product.name} ({item.variation.size} -{" "}
            {item.variation.color}) — R$ {centsToReais(item.priceCents * item.quantity)}
          </li>
        ))}
      </ul>

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
        <p>Endereço indisponível.</p>
      )}

      <h2>Total</h2>
      <p>Subtotal: R$ {centsToReais(order.totalCents - order.shippingCents)}</p>
      <p>
        Frete: {order.shippingCents > 0 ? `R$ ${centsToReais(order.shippingCents)}` : "a calcular"}
      </p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(order.totalCents)}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar manualmente — incluindo o teste de isolamento**

Run: `npm run dev`. Como o checkout ainda não liga pedido a usuário (Task 6), para testar agora é preciso preencher o `userId` de um pedido direto no banco.

1. Fazer um pedido pela loja, e no banco setar o `userId` dele para o cliente A. Logado como A, `/conta/pedidos` deve listá-lo; abrir os detalhes deve funcionar.
2. `/conta/pedidos` do cliente B (sem pedidos) deve mostrar a mensagem de lista vazia.
3. **Teste de isolamento (o mais importante):** logado como cliente B, acessar `/conta/pedidos/<id-do-pedido-do-cliente-A>` diretamente pela URL. **Deve dar 404**, não mostrar o pedido. Se mostrar, é vazamento de dados pessoais de outro cliente.
4. Deslogado, acessar `/conta/pedidos` — deve mandar pro login.

Restaurar os dados de teste e registrar o que foi mexido.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(loja\)/conta/pedidos
git commit -m "feat: add customer order history"
```

---

### Task 6: Checkout ciente da conta

**Files:**
- Modify: `src/app/(loja)/checkout/actions.ts` (preencher `userId` quando houver sessão)
- Modify: `src/app/(loja)/checkout/CheckoutForm.tsx` (escolher endereço salvo)
- Modify: `src/app/(loja)/checkout/page.tsx` (carregar endereços e email do usuário)

**Interfaces:**
- Consumes: `auth` de `src/lib/auth.ts`, `prisma`

**Cuidado com o que já está verificado:** `placeOrder` foi revisado em detalhe e a regra é que **nenhum valor de dinheiro vem do navegador**. Esta task não muda nada disso — só acrescenta o `userId` (que vem da sessão, não do formulário) e facilita o preenchimento do endereço. O recálculo do carrinho via `loadCart` continua igual.

- [ ] **Step 1: Preencher o `userId` na criação do pedido**

Modify `src/app/(loja)/checkout/actions.ts`:

1. Adicionar ao topo, junto dos imports existentes:
```typescript
import { auth } from "@/lib/auth";
```

2. Dentro de `placeOrder`, antes do bloco `try` que cria o pedido, obter o usuário da sessão:
```typescript
  // Vem da sessão, nunca do formulário — um userId enviado pelo cliente
  // deixaria qualquer um atribuir pedidos à conta de outra pessoa.
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
```

3. No objeto `data:` do `tx.order.create`, adicionar `userId,` junto dos campos já existentes.

Nada mais muda: convidado continua funcionando com `userId` nulo.

- [ ] **Step 2: Oferecer os endereços salvos no formulário**

Modify `src/app/(loja)/checkout/CheckoutForm.tsx`:

1. Estender as props do componente para receber os dados do usuário logado:
```tsx
type SavedAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

export function CheckoutForm({
  savedAddresses,
  defaultEmail,
}: {
  savedAddresses: SavedAddress[];
  defaultEmail: string | null;
}) {
```

2. O input de email passa a usar `defaultValue={defaultEmail ?? ""}`.

3. Os campos que hoje são controlados pelo estado `address` (`zipCode`, `street`, `neighborhood`, `city`, `state`) já aceitam preenchimento programático. Adicionar `recipientName`, `number` e `complement` ao mesmo estado `address` (hoje eles são não-controlados) para que a seleção de um endereço salvo preencha o formulário inteiro. Ajustar o estado inicial e os inputs correspondentes.

4. Acima dos campos de entrega, quando houver endereços salvos, adicionar o seletor:
```tsx
      {savedAddresses.length > 0 && (
        <label>
          Usar um endereço salvo:{" "}
          <select
            defaultValue=""
            onChange={(e) => {
              const chosen = savedAddresses.find((a) => a.id === e.target.value);
              if (!chosen) {
                return;
              }
              setAddress({
                recipientName: chosen.recipientName,
                zipCode: chosen.zipCode,
                street: chosen.street,
                number: chosen.number,
                complement: chosen.complement ?? "",
                neighborhood: chosen.neighborhood,
                city: chosen.city,
                state: chosen.state,
              });
            }}
          >
            <option value="">Digitar um novo endereço</option>
            {savedAddresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ? `${a.label} — ` : ""}
                {a.street}, {a.number}
              </option>
            ))}
          </select>
        </label>
      )}
```

O endereço escolhido apenas **preenche** os campos — o que é enviado continua sendo o conteúdo dos inputs, que `placeOrder` valida com `parseAddress` como sempre. Nenhum `addressId` é enviado, então não há como referenciar o endereço de outra pessoa.

- [ ] **Step 3: Carregar os dados na página**

Modify `src/app/(loja)/checkout/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null } | undefined;

  const savedAddresses = user?.id
    ? await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <h1>Finalizar compra</h1>
      <CheckoutForm savedAddresses={savedAddresses} defaultEmail={user?.email ?? null} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`.

1. **Convidado continua funcionando:** deslogado, comprar normalmente — o pedido tem que ser criado, e no banco o `userId` fica nulo.
2. **Logado:** com um endereço salvo, ir ao checkout — o email deve vir preenchido e o seletor de endereço deve aparecer. Escolher o endereço salvo deve preencher todos os campos de entrega. Finalizar — o pedido deve ser criado com o `userId` do cliente, e aparecer em `/conta/pedidos`.
3. Escolher "Digitar um novo endereço" e preencher à mão deve continuar funcionando.
4. Conferir que o total do pedido continua vindo do servidor (o valor gravado tem que bater com a soma dos itens pelo preço do banco, não com nada enviado pelo navegador).

- [ ] **Step 5: Rodar testes e build**

Run: `npm test` — Expected: PASS
Run: `npm run build` — Expected: build limpo; conferir que nenhuma rota `/conta/*` aparece em `.next/prerender-manifest.json`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(loja\)/checkout
git commit -m "feat: associate orders with signed-in customers and offer saved addresses"
```

## Definição de pronto (Plano Conta do Cliente)

- [ ] `npm run dev` e `npm run build` limpos; nenhuma rota `/conta/*` no prerender manifest
- [ ] `npm test` passa (69 anteriores + os novos de cadastro)
- [ ] Cliente cria conta, entra automaticamente, e cai em `/conta`
- [ ] **Login manda admin para `/admin` e cliente para `/conta`** — o bug registrado desde o primeiro plano
- [ ] `callbackUrl` funciona para voltar à página pretendida, e **um `callbackUrl` externo é ignorado** (sem redirecionador aberto)
- [ ] `/conta/*` exige login; deslogado vai para o login com `callbackUrl`
- [ ] Cliente salva e remove endereços
- [ ] **Um cliente não consegue apagar endereço de outro** — verificado forçando a action com id alheio
- [ ] **Um cliente não consegue ver pedido de outro** — verificado acessando a URL do pedido alheio (404)
- [ ] **Nenhum pedido de convidado é adotado por email** em nenhuma circunstância
- [ ] Cadastro nunca cria usuário com `isAdmin = true`
- [ ] Checkout de convidado continua funcionando; checkout logado grava `userId` e oferece endereços salvos
- [ ] Nenhum arquivo `.env.example` foi criado
