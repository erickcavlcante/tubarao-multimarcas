import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin;

  if (!isAdmin) {
    redirect("/login");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #ddd" }}>
        <strong>Admin</strong>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link href="/admin/produtos">Produtos</Link>
          <Link href="/admin/categorias">Categorias</Link>
        </nav>
        <form action={handleSignOut}>
          <button type="submit">Sair</button>
        </form>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </div>
  );
}
