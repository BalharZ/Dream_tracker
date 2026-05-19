import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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

const authSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

function LoginForm() {
  const { loginMutation } = useAuth();
  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
      className="space-y-4 mt-4"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          {...form.register("username")}
          placeholder="Enter your username"
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
    </form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))}
      className="space-y-4 mt-4"
    >
      <div className="space-y-2">
        <Label htmlFor="reg-username">Username</Label>
        <Input
          id="reg-username"
          {...form.register("username")}
          placeholder="Choose a username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          type="password"
          {...form.register("password")}
          placeholder="Choose a password"
        />
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
