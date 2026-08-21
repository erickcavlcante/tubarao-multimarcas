"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Email ou senha inválidos");
      return;
    }
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl && callbackUrl.startsWith("/")) {
      router.push(callbackUrl);
    } else {
      const session = await getSession();
      const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
      router.push(isAdmin ? "/admin" : "/conta");
    }
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Entrar</button>
        <p>
          Não tem conta? <Link href="/cadastro">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
