"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="rounded-[7px] border-2 px-3 py-1.5 text-[0.76rem] font-semibold disabled:opacity-50"
      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
    >
      {busy ? "…" : "Logout"}
    </button>
  );
}
