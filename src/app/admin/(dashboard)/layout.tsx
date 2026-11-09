import { Suspense } from "react";
import { AdminBrand, AdminSidebarNav } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { ThemeToggle } from "@/components/site/theme-toggle";

/**
 * Admin shell. The chrome is static; anything that reads the session is
 * pushed into Suspense boundaries (Cache Components requirement), and every
 * page re-verifies the admin itself.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex items-center justify-between gap-4 border-b px-3 py-2 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0 md:px-3 md:py-4">
        <div className="md:px-2.5 md:pb-4">
          <AdminBrand />
        </div>
        <AdminSidebarNav />
        <div className="flex items-center gap-1 md:mt-auto md:justify-between md:px-1">
          <Suspense fallback={<div className="size-7 rounded-full bg-muted" />}>
            <AdminUserMenu />
          </Suspense>
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
