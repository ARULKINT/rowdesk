import { requireAdmin } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <AppHeader user={user} />
      <div className="mx-auto w-full max-w-[1100px] px-5 py-6">{children}</div>
    </div>
  );
}
