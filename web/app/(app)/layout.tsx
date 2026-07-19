import { BottomNav } from "@/components/layout/bottom-nav";
import { SessionBootstrap } from "@/components/layout/session-bootstrap";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SessionBootstrap />
      <Sidebar />
      <main className="min-h-screen pt-12 pb-16 md:pt-0 md:pb-0 md:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
