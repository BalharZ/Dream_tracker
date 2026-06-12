import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Star,
  Target,
  Repeat2,
  Gift,
  Trophy,
  CalendarDays,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Dreams", href: "/dreams", icon: Star },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Rewards", href: "/rewards", icon: Gift },
  { name: "Habits", href: "/habits", icon: Repeat2 },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Stash", href: "/stash", icon: Trophy },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
            Dream Tracker
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={location === item.href ? "default" : "ghost"}
                className={cn(
                  "flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium w-full min-w-[180px]",
                  location === item.href ? "bg-primary text-primary-foreground" : ""
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </Button>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Dream Tracker
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        {navigation.map((item) => {
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-14 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-screen min-w-0 overflow-x-hidden">
        <div className="container mx-auto p-6 pt-20 pb-24 md:pt-6 md:pb-6">{children}</div>
      </main>
    </div>
  );
}