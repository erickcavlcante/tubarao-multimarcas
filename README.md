This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Variáveis de ambiente

Este projeto usa Auth.js / NextAuth v5 (beta), que lê os nomes de variável do
Auth.js — **não** os nomes antigos do NextAuth v4 (`NEXTAUTH_SECRET`,
`NEXTAUTH_URL`). Em `.env` (não commitado):

- `AUTH_SECRET` — segredo usado para assinar sessões/JWTs.
- `AUTH_URL` — URL pública do site. Em produção precisa ser a URL real
  (ex.: `https://sualoja.com.br`), não `localhost`. Sem essa variável (ou
  outro sinal de host confiável, como estar rodando na Vercel), o Auth.js
  rejeita as requisições de `/api/auth/*` em produção com `UntrustedHost` e
  ninguém consegue entrar — nem cliente, nem admin.
- `DATABASE_URL` — string de conexão do Postgres.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenciais usadas pelo seed
  (`prisma/seed.ts`) para criar/atualizar a conta de administrador.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
