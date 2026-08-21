import Link from "next/link";
import { signOut } from "@/lib/auth";

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
        <Link href="/conta">Meus dados</Link>
        <Link href="/conta/enderecos">Endereços</Link>
        <Link href="/conta/pedidos">Meus pedidos</Link>
        <form action={handleSignOut}>
          <button type="submit">Sair</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
