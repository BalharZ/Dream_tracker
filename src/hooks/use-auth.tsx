import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

type AuthUser = {
  id: string;
  username: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<AuthUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<AuthUser, Error, RegisterData>;
};

type LoginData = { username: string; password: string };
type RegisterData = { username: string; password: string };

function toAuthUser(user: User): AuthUser {
  const email = user.email ?? user.id;
  return {
    id: user.id,
    username: email.endsWith("@dreamtracker.app")
      ? email.replace("@dreamtracker.app", "")
      : email,
  };
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setIsLoading(false);
    }).catch(() => {
      // Network error — treat as no session
      setUser(null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const email = credentials.username.includes("@")
        ? credentials.username
        : `${credentials.username}@dreamtracker.app`;
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
      const email = credentials.username.includes("@")
        ? credentials.username
        : `${credentials.username}@dreamtracker.app`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password: credentials.password,
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Registration failed");
      return toAuthUser(data.user);
    },
    onSuccess: (user) => setUser(user),
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => setUser(null),
    onError: (error: Error) => {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, error, loginMutation, logoutMutation, registerMutation }}>
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
