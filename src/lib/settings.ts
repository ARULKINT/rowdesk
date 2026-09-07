import "server-only";
import { prisma } from "@/lib/prisma";

export const SETTINGS_DEFAULTS = {
  claimTimeoutMinutes: 30,
  timezone: "Asia/Kolkata",
};

export type SettingsData = typeof SETTINGS_DEFAULTS;

export async function getSettings(): Promise<SettingsData> {
  const rows = await prisma.systemSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const claimTimeoutMinutes = Number(map.get("claimTimeoutMinutes"));

  return {
    claimTimeoutMinutes: Number.isFinite(claimTimeoutMinutes)
      ? claimTimeoutMinutes
      : SETTINGS_DEFAULTS.claimTimeoutMinutes,
    timezone: map.get("timezone") ?? SETTINGS_DEFAULTS.timezone,
  };
}

export async function setSetting(key: keyof SettingsData, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
