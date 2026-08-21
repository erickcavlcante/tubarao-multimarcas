"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (!state?.ok || autoLoginAttempted.current) {
      return;
    }
    autoLoginAttempted.current = true;
    // Cadastro deu certo: entra automaticamente e leva pra área da conta.
    signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        setAutoLoginFailed(true);
        return;
      }
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
      {autoLoginFailed && (
        <p style={{ color: "#b45309" }}>
          Sua conta foi criada, mas não conseguimos entrar automaticamente.{" "}
          <Link href="/login">Entre aqui</Link>.
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
      <p>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </form>
  );
}
