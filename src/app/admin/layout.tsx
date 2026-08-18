import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

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
        <form action={handleSignOut}>
          <button type="submit">Sair</button>
        </form>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </div>
  );
}
