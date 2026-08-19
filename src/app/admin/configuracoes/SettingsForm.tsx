"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsActionState } from "./actions";

type Settings = {
  freeShippingCents: number;
  pixDiscountPercent: number;
  maxInstallments: number;
  packageWidthCm: number;
  packageHeightCm: number;
  packageLengthCm: number;
  defaultWeightGrams: number;
  originZipCode: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(
    updateSettings,
    undefined
  );

  return (
    <form action={formAction}>
      <h2>Loja</h2>
      <label>
        Frete grátis acima de (R$):{" "}
        <input
          type="text"
          name="freeShipping"
          defaultValue={(settings.freeShippingCents / 100).toFixed(2).replace(".", ",")}
          required
        />
      </label>
      <label>
        Desconto no Pix (%):{" "}
        <input type="number" name="pixDiscount" min={0} max={100} defaultValue={settings.pixDiscountPercent} required />
      </label>
      <label>
        Máximo de parcelas:{" "}
        <input type="number" name="maxInstallments" min={1} max={24} defaultValue={settings.maxInstallments} required />
      </label>

      <h2>Envio</h2>
      <label>
        CEP de origem:{" "}
        <input
          type="text"
          name="originZipCode"
          placeholder="00000000"
          defaultValue={settings.originZipCode ?? ""}
          required
        />
      </label>
      <label>
        Peso padrão de uma peça (gramas):{" "}
        <input type="number" name="defaultWeight" min={1} defaultValue={settings.defaultWeightGrams} required />
      </label>
      <fieldset>
        <legend>Embalagem padrão (cm)</legend>
        <label>
          Largura: <input type="number" name="packageWidth" min={1} defaultValue={settings.packageWidthCm} required />
        </label>
        <label>
          Altura: <input type="number" name="packageHeight" min={1} defaultValue={settings.packageHeightCm} required />
        </label>
        <label>
          Comprimento:{" "}
          <input type="number" name="packageLength" min={1} defaultValue={settings.packageLengthCm} required />
        </label>
      </fieldset>

      {state?.error && <p style={{ color: "red" }}>{state.error}</p>}
      {state?.ok && <p style={{ color: "green" }}>Configurações salvas.</p>}
      <button type="submit" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}
