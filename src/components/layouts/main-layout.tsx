import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import {
  LayoutDashboard,
  Star,
  Target,
  Repeat2,
  Gift,
  Download,
  Settings,
} from "lucide-react";

// Served from public/ by Vercel; the native shell loads the live site so the
// download button only makes sense in a regular browser.
const ANDROID_APK_URL = "/DreamTracker.apk";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Dreams", href: "/dreams", icon: Star },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Rewards", href: "/rewards", icon: Gift },
  { name: "Habits", href: "/habits", icon: Repeat2 },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar — night sky, gold for the active item. */}
      <aside className="hidden md:flex sticky top-0 h-screen flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-6">
          <Brand className="text-white" />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navigation.map((item) => (
            <SidebarLink key={item.href} href={item.href} icon={item.icon} active={location === item.href}>
              {item.name}
            </SidebarLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          {!Capacitor.isNativePlatform() && (
            <a
              href={ANDROID_APK_URL}
              download="Northstar.apk"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Download className="h-5 w-5" />
              Get Android app
            </a>
          )}
          <SidebarLink href="/settings" icon={Settings} active={location === "/settings"}>
            Settings
          </SidebarLink>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <Brand />
        <div className="flex items-center">
          {/* Browser only: download the Android APK. */}
          {!Capacitor.isNativePlatform() && (
            <Button variant="ghost" size="icon" asChild>
              <a
                href={ANDROID_APK_URL}
                download="Northstar.apk"
                aria-label="Get Android app"
                title="Get Android app"
              >
                <Download className="h-5 w-5" />
              </a>
            </Button>
          )}
          {/* "Check for updates" (reload) lives in Settings only — removed from
             the header to declutter (owner request). */}
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border/70 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {navigation.map((item) => {
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-full h-16 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-gold/40"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                </span>
                <span className="truncate">{item.name}</span>
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-screen min-w-0 overflow-x-hidden">
        <div className="container mx-auto max-w-6xl p-4 pt-20 pb-28 sm:p-6 sm:pt-20 md:pt-8 md:pb-8">{children}</div>
      </main>
    </div>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src="/icons/icon-512.png" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
      <span className="font-display text-xl font-bold tracking-tight">Northstar</span>
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
