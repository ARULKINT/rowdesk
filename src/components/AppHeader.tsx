import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

const PROCESSOR_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/statistics", label: "My Statistics" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/statistics", label: "Statistics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/drive", label: "Google Drive" },
  { href: "/admin/queue", label: "Processing Queue" },
  { href: "/admin/templates", label: "Template Dictionaries" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/profile", label: "Profile" },
];

export default function AppHeader({ user }: { user: SessionUser }) {
  const nav = user.role === "ADMIN" ? ADMIN_NAV : PROCESSOR_NAV;

  return (
    <div
      className="border-b-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-baseline gap-2">
          <Link
            href="/dashboard"
            className="text-[1.05rem] font-extrabold tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
          >
            Rowdesk
          </Link>
          <span
            className="text-[0.65rem] uppercase tracking-[0.08em]"
            style={{ fontFamily: "var(--font-data-stack)", color: "var(--ink-muted)" }}
          >
            {user.role === "ADMIN" ? "Admin" : "Lead Queue"}
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-[0.8rem]">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[6px] px-2.5 py-1.5 font-medium"
              style={{ color: "var(--ink-muted)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span
            className="text-[0.78rem] font-medium"
            style={{ color: "var(--ink)", fontFamily: "var(--font-body-stack)" }}
          >
            {user.name}
          </span>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
