import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthGuard } from "@/components/auth-guard";
import { SidebarProvider } from "@/components/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-900">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
