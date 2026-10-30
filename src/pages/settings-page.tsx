import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { openExternalUrl } from "@/lib/local-notifications";
import { useState } from "react";
import {
  CloudUpload,
  Crown,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  LogOut,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportUserData } from "@/lib/export-data";
import { usePlan, type Plan } from "@/hooks/use-plan";

// Served from public/ by Vercel; the native shell loads the live site so the
// download button only makes sense in a regular browser.
const ANDROID_APK_URL = "/DreamTracker.apk";

// S59: nicer exports are Pro — shown greyed out next to the free JSON.
const PRO_EXPORTS = [
  { label: "Excel spreadsheet", Icon: FileSpreadsheet },
  { label: "PDF report", Icon: FileText },
  { label: "Automatic backup", Icon: CloudUpload },
  { label: "Restore from backup", Icon: History },
];

const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro Lifetime", pro_ai: "Pro + AI" };

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { plan, isPro, setTestPlan, openPaywall } = usePlan();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportUserData(user.id, user.email);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast({ title: "Export failed", description: error?.message, variant: "destructive" });
      }
    } finally {
      setExporting(false);
    }
  };
  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your account and the app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium break-all">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Log out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="font-medium">{PLAN_NAMES[plan]}</p>
            </div>
            {!isPro && <Button onClick={() => openPaywall("upgrade")}>See Pro</Button>}
          </div>
          {/* S57: TEST switch until payments exist (S66 replaces it with the
              entitlements table). Only changes this browser. */}
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test mode — simulate a plan
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLAN_NAMES) as Plan[]).map((p) => (
                <Button key={p} size="sm" variant={plan === p ? "default" : "outline"} onClick={() => setTestPlan(p)}>
                  {PLAN_NAMES[p]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments are not live yet. This switch only affects this device and will be removed at launch.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Your data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Button variant="outline" className="w-full justify-start" onClick={runExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileJson className="mr-2 h-5 w-5" />}
              Export data (JSON)
            </Button>
            <p className="text-xs text-muted-foreground">
              A raw copy of all your dreams, goals, habits, history and rewards. Free in every plan.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRO_EXPORTS.map(({ label, Icon }) => (
              <Button
                key={label}
                variant="outline"
                className="justify-start opacity-60"
                onClick={() => (isPro ? toast({ title: `${label} — coming soon` }) : openPaywall("export"))}
              >
                <Icon className="mr-2 h-5 w-5" />
                {label}
                <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">PRO</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNative ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Check for updates
                </Button>
                <p className="text-xs text-muted-foreground">
                  Reloads the app to pull the latest web version. Enough for most
                  updates.
                </p>
              </div>
              <div className="space-y-1">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    openExternalUrl(`${window.location.origin}${ANDROID_APK_URL}`)
                  }
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download latest app
                </Button>
                <p className="text-xs text-muted-foreground">
                  Opens your browser to download &amp; install the newest app.
                  Needed only after updates that change the app itself (like
                  notifications or the widget).
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={ANDROID_APK_URL} download="Northstar.apk">
                  <Download className="mr-2 h-5 w-5" />
                  Get Android app
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Download the Android app (APK).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
