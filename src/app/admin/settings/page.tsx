import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1
        className="mb-5 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Settings
      </h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
