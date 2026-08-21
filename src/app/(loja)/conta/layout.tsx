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
