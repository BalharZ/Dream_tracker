import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { seedDemoData, type DemoPreset } from "@/lib/seed-demo-data";
import { syncWidgetConfig, clearWidgetConfig } from "@/lib/widget-sync";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  // True after the user opens a password-reset link (Supabase PASSWORD_RECOVERY
  // event). While true the app shows the "set a new password" screen.
  passwordRecovery: boolean;
  loginMutation: UseMutationResult<AuthUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<AuthUser, Error, RegisterData>;
  // Emails a password-reset link to the given address.
  resetPasswordMutation: UseMutationResult<void, Error, string>;
  // Sets a new password (used on the recovery screen).
  updatePasswordMutation: UseMutationResult<void, Error, string>;
};

type LoginData = { email: string; password: string };
type RegisterData = { email: string; password: string; preset: DemoPreset };

function toAuthUser(user: User): AuthUser {
  const email = user.email ?? user.id;
  // Extract display name: part before @ or full email
  const displayName = email.includes("@")
    ? email.split("@")[0]
    : email;
  return {
    id: user.id,
    email,
    displayName,
  };
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const isRegisteringRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setIsLoading(false);
    }).catch(() => {
      // Network error — treat as no session
      setUser(null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Opening the emailed reset link signs the user in with a recovery
      // session and fires this event — switch the UI to "set a new password".
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (isRegisteringRef.current) return;
      const newUser = session?.user ? toAuthUser(session.user) : null;
      setUser((prev) => {
        if (prev?.id !== newUser?.id) {
          queryClient.clear();
        }
        return newUser;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  // S17: hand the Android home-screen widget its token/config (no-op in browser).
  useEffect(() => {
    if (user?.id) syncWidgetConfig(user.id);
  }, [user?.id]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Support old username-based accounts (e.g. "demo" → "demo@dreamtracker.app")
      const email = credentials.email.includes("@")
        ? credentials.email
        : `${credentials.email}@dreamtracker.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: credentials.password,
      });
      if (error) throw new Error(error.message);
      return toAuthUser(data.user);
    },
    onSuccess: (user) => setUser(user),
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      if (!credentials.email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }
      isRegisteringRef.current = true;
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
      });
      if (error) {
        isRegisteringRef.current = false;
        throw new Error(error.message);
      }
      if (!data.user) {
        isRegisteringRef.current = false;
        throw new Error("Registration failed");
      }
      await seedDemoData(data.user.id, credentials.preset).catch(() => {});
      isRegisteringRef.current = false;
      return toAuthUser(data.user);
    },
    onSuccess: (user) => {
      queryClient.clear();
      setUser(user);
    },
    onError: (error: Error) => {
      isRegisteringRef.current = false;
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.clear();
      setUser(null);
      clearWidgetConfig();
    },
    onError: (error: Error) => {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (rawEmail: string) => {
      // Same old-username fallback as login (e.g. "demo" → "demo@dreamtracker.app").
      const email = rawEmail.includes("@")
        ? rawEmail
        : `${rawEmail}@dreamtracker.app`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({
        title: "Check your email",
        description: "We sent you a link to reset your password.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't send reset email", description: error.message, variant: "destructive" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasswordRecovery(false);
      toast({ title: "Password updated", description: "You're all set." });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, error, passwordRecovery, loginMutation, logoutMutation, registerMutation, resetPasswordMutation, updatePasswordMutation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
