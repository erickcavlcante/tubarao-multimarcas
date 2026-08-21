import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default function CadastroPage() {
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Criar conta</h1>
      <RegisterForm />
    </div>
  );
}
