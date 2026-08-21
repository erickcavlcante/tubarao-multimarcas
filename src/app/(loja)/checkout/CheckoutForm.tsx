"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "../_components/CartProvider";
import { loadCart, type LoadedCart } from "../carrinho/actions";
import { placeOrder, type PlaceOrderState } from "./actions";
import { centsToReais } from "@/lib/money";

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
  const { lines, ready } = useCart();
  const [cart, setCart] = useState<LoadedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);
  const [address, setAddress] = useState({
    recipientName: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(
    placeOrder,
    undefined
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    loadCart(lines)
      .then((result) => {
        if (!cancelled) {
          setCart(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lines, ready]);

  async function handleCepBlur() {
    const cep = address.zipCode.replace(/\D/g, "");
    if (cep.length !== 8) {
      return;
    }
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setAddress((prev) => ({
          ...prev,
          street: data.logradouro ?? prev.street,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }));
      }
    } catch {
      // ViaCEP fora do ar — o cliente preenche à mão, não bloqueia nada
    } finally {
      setCepLoading(false);
    }
  }

  if (!ready || loading) {
    return <p>Carregando...</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div>
        <p>Seu carrinho está vazio.</p>
        <Link href="/produtos">Ver produtos</Link>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <h2>Contato</h2>
      <label>
        Email:{" "}
        <input
          type="email"
          name="contactEmail"
          required
          placeholder="seu@email.com"
          defaultValue={defaultEmail ?? ""}
        />
      </label>

      <h2>Entrega</h2>
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
      <label>
        Nome de quem vai receber:{" "}
        <input
          type="text"
          name="recipientName"
          required
          value={address.recipientName}
          onChange={(e) => setAddress((prev) => ({ ...prev, recipientName: e.target.value }))}
        />
      </label>
      <label>
        CEP:{" "}
        <input
          type="text"
          name="zipCode"
          required
          maxLength={9}
          value={address.zipCode}
          onChange={(e) => setAddress((prev) => ({ ...prev, zipCode: e.target.value }))}
          onBlur={handleCepBlur}
        />
      </label>
      {cepLoading && <span> buscando endereço...</span>}
      <label>
        Rua:{" "}
        <input
          type="text"
          name="street"
          required
          value={address.street}
          onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
        />
      </label>
      <label>
        Número:{" "}
        <input
          type="text"
          name="number"
          required
          value={address.number}
          onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
        />
      </label>
      <label>
        Complemento:{" "}
        <input
          type="text"
          name="complement"
          value={address.complement}
          onChange={(e) => setAddress((prev) => ({ ...prev, complement: e.target.value }))}
        />
      </label>
      <label>
        Bairro:{" "}
        <input
          type="text"
          name="neighborhood"
          required
          value={address.neighborhood}
          onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
        />
      </label>
      <label>
        Cidade:{" "}
        <input
          type="text"
          name="city"
          required
          value={address.city}
          onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
        />
      </label>
      <label>
        Estado (sigla):{" "}
        <input
          type="text"
          name="state"
          required
          maxLength={2}
          value={address.state}
          onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value }))}
        />
      </label>

      <h2>Resumo</h2>
      <ul>
        {cart.items.map((item) => (
          <li key={item.variationId}>
            {item.quantity}x {item.productName} ({item.size} - {item.color}) — R${" "}
            {centsToReais(item.lineTotalCents)}
          </li>
        ))}
      </ul>
      <p>Subtotal: R$ {centsToReais(cart.subtotalCents)}</p>
      <p>Frete: a calcular</p>
      <p style={{ fontWeight: "bold" }}>Total: R$ {centsToReais(cart.subtotalCents)}</p>

      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      <button type="submit" disabled={pending} style={{ padding: "12px 24px" }}>
        {pending ? "Finalizando..." : "Finalizar pedido"}
      </button>
      <p style={{ color: "#666" }}>
        O pagamento será habilitado em breve. Por enquanto o pedido é registrado e a loja entra em
        contato.
      </p>
    </form>
  );
}
