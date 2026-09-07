import { requireUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <AppHeader user={user} />
      <div className="mx-auto w-full max-w-[560px] px-5 py-6">
        <h1
          className="mb-5 text-[1.1rem] font-bold"
          style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
        >
          Profile
        </h1>

        <div
          className="mb-6 rounded-[12px] border-2 p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <dl className="grid grid-cols-[100px_1fr] gap-y-3 text-[0.88rem]">
            <dt style={{ color: "var(--ink-muted)" }}>Name</dt>
            <dd style={{ color: "var(--ink)" }}>{user.name}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>Username</dt>
            <dd style={{ color: "var(--ink)", fontFamily: "var(--font-data-stack)" }}>
              {user.username}
            </dd>
            <dt style={{ color: "var(--ink-muted)" }}>Role</dt>
            <dd style={{ color: "var(--ink)" }}>
              {user.role === "ADMIN" ? "Admin" : "Data Processor"}
            </dd>
          </dl>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
