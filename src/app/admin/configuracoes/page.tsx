import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./SettingsForm";

export default async function ConfiguracoesPage() {
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });

  if (!settings) {
    notFound();
  }

  return (
    <div>
      <h1>Configurações</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
