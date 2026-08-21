"use client";

import { useActionState } from "react";
import { addAddress, deleteAddress, type AddressState } from "./actions";

type Address = {
  id: string;
  label: string | null;
  recipientName: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

function AddressRow({ address }: { address: Address }) {
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    deleteAddress,
    undefined
  );

  return (
    <li style={{ marginBottom: 12 }}>
      {address.label && <strong>{address.label} — </strong>}
      {address.recipientName}
      <br />
      {address.street}, {address.number}
      {address.complement ? ` - ${address.complement}` : ""}
      <br />
      {address.neighborhood} - {address.city}/{address.state} — CEP {address.zipCode}
      <form action={formAction}>
        <input type="hidden" name="addressId" value={address.id} />
        <button type="submit" disabled={pending}>
          Remover
        </button>
      </form>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
    </li>
  );
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    addAddress,
    undefined
  );

  return (
    <div>
      {addresses.length === 0 ? (
        <p>Você ainda não salvou nenhum endereço.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {addresses.map((address) => (
            <AddressRow key={address.id} address={address} />
          ))}
        </ul>
      )}

      <h2>Adicionar endereço</h2>
      <form action={formAction}>
        <label>
          Apelido (ex: Casa, Trabalho): <input type="text" name="label" />
        </label>
        <label>
          Nome de quem recebe: <input type="text" name="recipientName" required />
        </label>
        <label>
          CEP: <input type="text" name="zipCode" required maxLength={9} />
        </label>
        <label>
          Rua: <input type="text" name="street" required />
        </label>
        <label>
          Número: <input type="text" name="number" required />
        </label>
        <label>
          Complemento: <input type="text" name="complement" />
        </label>
        <label>
          Bairro: <input type="text" name="neighborhood" required />
        </label>
        <label>
          Cidade: <input type="text" name="city" required />
        </label>
        <label>
          Estado (sigla): <input type="text" name="state" required maxLength={2} />
        </label>
        {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
        {state?.ok && <p style={{ color: "#166534" }}>Endereço salvo.</p>}
        <button type="submit" disabled={pending}>
          Salvar endereço
        </button>
      </form>
    </div>
  );
}
