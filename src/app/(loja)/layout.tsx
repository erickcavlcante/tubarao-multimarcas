import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CartProvider } from "./_components/CartProvider";
import { CartLink } from "./_components/CartLink";

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const freeShippingReais = settings
    ? (settings.freeShippingCents / 100).toFixed(2).replace(".", ",")
    : null;

  return (
    <CartProvider>
      <div>
        <header style={{ borderBottom: "1px solid #ddd", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/" style={{ fontWeight: "bold", fontSize: 20, textDecoration: "none", color: "inherit" }}>
              Loja
            </Link>
            <nav style={{ display: "flex", gap: 16 }}>
              <Link href="/produtos">Todos os produtos</Link>
              <Link href="/conta">Minha conta</Link>
              <CartLink />
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
    </CartProvider>
  );
}
