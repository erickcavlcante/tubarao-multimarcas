export type ShippingAddress = {
  recipientName: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

const REQUIRED_LABELS: Record<string, string> = {
  recipientName: "Nome do destinatário",
  street: "Rua",
  number: "Número",
  neighborhood: "Bairro",
  city: "Cidade",
};

export function parseAddress(
  form: Record<string, string | undefined>
): { address: ShippingAddress } | { error: string } {
  const value = (key: string) => String(form[key] ?? "").trim();

  for (const [key, label] of Object.entries(REQUIRED_LABELS)) {
    if (!value(key)) {
      return { error: `${label} é obrigatório` };
    }
  }

  const zipCode = value("zipCode").replace(/\D/g, "");
  if (zipCode.length !== 8) {
    return { error: "CEP deve ter 8 dígitos" };
  }

  const state = value("state").toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return { error: "Estado deve ser a sigla de 2 letras (ex: SP)" };
  }

  return {
    address: {
      recipientName: value("recipientName"),
      zipCode,
      street: value("street"),
      number: value("number"),
      complement: value("complement") || null,
      neighborhood: value("neighborhood"),
      city: value("city"),
      state,
    },
  };
}

export function readShippingAddress(value: unknown): ShippingAddress | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const requiredStrings = [
    "recipientName",
    "zipCode",
    "street",
    "number",
    "neighborhood",
    "city",
    "state",
  ] as const;

  for (const key of requiredStrings) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string)) {
      return null;
    }
  }

  return {
    recipientName: candidate.recipientName as string,
    zipCode: candidate.zipCode as string,
    street: candidate.street as string,
    number: candidate.number as string,
    complement: typeof candidate.complement === "string" ? candidate.complement : null,
    neighborhood: candidate.neighborhood as string,
    city: candidate.city as string,
    state: candidate.state as string,
  };
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
