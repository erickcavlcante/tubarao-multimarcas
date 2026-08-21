export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export const MIN_PASSWORD_LENGTH = 8;

export function validateRegistration(
  input: RegistrationInput
): { data: { name: string; email: string; password: string } } | { error: string } {
  const name = String(input.name ?? "").trim();
  if (!name) {
    return { error: "Nome é obrigatório" };
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email inválido" };
  }

  const password = String(input.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }

  if (password !== String(input.passwordConfirm ?? "")) {
    return { error: "As senhas não conferem" };
  }

  return { data: { name, email, password } };
}
