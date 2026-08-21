"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <h1>Algo deu errado</h1>
      <p>
        Não conseguimos completar essa ação. Nenhuma alteração foi perdida — tente novamente em
        alguns instantes.
      </p>
      <button type="button" onClick={reset} style={{ padding: "8px 16px" }}>
        Tentar novamente
      </button>
    </div>
  );
}
