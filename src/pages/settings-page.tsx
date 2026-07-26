import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { Download, LogOut, RefreshCw, Settings as SettingsIcon } from "lucide-react";

// Served from public/ by Vercel; the native shell loads the live site so the
// download button only makes sense in a regular browser.
const ANDROID_APK_URL = "/DreamTracker.apk";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
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
          <CardTitle>App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNative ? (
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
                Reloads the app to pull the latest version.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={ANDROID_APK_URL} download="DreamTracker.apk">
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
