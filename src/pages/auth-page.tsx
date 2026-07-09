import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DemoPreset } from "@/lib/seed-demo-data";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { isLoading } = useAuth();
  
  // Use useEffect for navigation to avoid React warnings
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);
  
  // Show loading state while auth is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }
  
  // If user is already logged in, render nothing (redirect will happen)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl grid md:grid-cols-2 gap-6 p-6">
        <div className="flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Dream Tracker</h1>
            <p className="text-muted-foreground">
              Track your dreams, set goals, and build habits that lead to success
            </p>
          </div>

          <AuthTabs />
        </div>

        <div className="hidden md:block relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-20 rounded-lg" />
          <div className="relative p-6 text-center space-y-4">
            <h2 className="text-2xl font-semibold">Why Dream Tracker?</h2>
            <ul className="text-left space-y-2">
              <li>✨ Set and track meaningful life goals</li>
              <li>🎯 Break down dreams into achievable goals</li>
              <li>📈 Build daily habits that lead to success</li>
              <li>🏆 Earn rewards for consistent progress</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AuthTabs() {
  const [tab, setTab] = useState<"login" | "register">("login");
  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-2 rounded-md bg-muted p-1">
        <button
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${tab === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("login")}
        >
          Login
        </button>
        <button
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${tab === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("register")}
        >
          Register
        </button>
      </div>
      {tab === "login" ? <LoginForm /> : <RegisterForm />}
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const [showReset, setShowReset] = useState(false);
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  if (showReset) {
    return <ForgotPasswordForm onBack={() => setShowReset(false)} />;
  }

  return (
    <form
      onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
      className="space-y-4 mt-4"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...form.register("email")}
          placeholder="Enter your email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...form.register("password")}
          placeholder="Enter your password"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Login
      </Button>

      <Button
        type="button"
        variant="link"
        className="w-full h-auto p-0 text-sm text-muted-foreground"
        onClick={() => setShowReset(true)}
      >
        Forgot your password?
      </Button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { resetPasswordMutation } = useAuth();
  const form = useForm({ defaultValues: { email: "" } });

  return (
    <form
      onSubmit={form.handleSubmit(({ email }) =>
        resetPasswordMutation.mutate(email, { onSuccess: onBack })
      )}
      className="space-y-4 mt-4"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Reset password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a link to set a new password.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          {...form.register("email")}
          placeholder="Enter your email"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={resetPasswordMutation.isPending}
      >
        {resetPasswordMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Send reset link
      </Button>

      <Button
        type="button"
        variant="link"
        className="w-full h-auto p-0 text-sm text-muted-foreground"
        onClick={onBack}
      >
        Back to login
      </Button>
    </form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [preset, setPreset] = useState<DemoPreset>("male");
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) =>
        registerMutation.mutate({ ...data, preset })
      )}
      className="space-y-4 mt-4"
    >
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          type="email"
          {...form.register("email")}
          placeholder="Enter your email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          type="password"
          {...form.register("password")}
          placeholder="Choose a password (min 6 characters)"
        />
      </div>

      <div className="space-y-2">
        <Label>Starter examples</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={preset === "male" ? "default" : "outline"}
            onClick={() => setPreset("male")}
          >
            For him
          </Button>
          <Button
            type="button"
            variant={preset === "female" ? "default" : "outline"}
            onClick={() => setPreset("female")}
          >
            For her
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          We'll preload sample dreams, goals, habits and rewards so you can
          explore the app. You can delete them anytime.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={registerMutation.isPending}
      >
        {registerMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Register
      </Button>
    </form>
  );
}

// Shown full-screen after the user follows a password-reset link (recovery
// session active). Rendered from App when `passwordRecovery` is true.
export function UpdatePasswordScreen() {
  const { updatePasswordMutation } = useAuth();
  const form = useForm({ defaultValues: { password: "" } });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>
        <form
          onSubmit={form.handleSubmit(({ password }) =>
            updatePasswordMutation.mutate(password)
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              minLength={6}
              required
              {...form.register("password")}
              placeholder="Choose a password (min 6 characters)"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updatePasswordMutation.isPending}
          >
            {updatePasswordMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
