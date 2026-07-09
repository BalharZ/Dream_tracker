import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage, { UpdatePasswordScreen } from "@/pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";
import HomePage from "@/pages/home-page";
import DreamsPage from "@/pages/dreams-page";
import GoalsPage from "@/pages/goals-page";
import HabitsPage from "@/pages/habits-page";
import RewardsPage from "@/pages/rewards-page";
import CalendarPage from "@/pages/calendar-page";
import MainLayout from "./components/layouts/main-layout";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/dreams" component={DreamsPage} />
      <ProtectedRoute path="/goals" component={GoalsPage} />
      <ProtectedRoute path="/rewards" component={RewardsPage} />
      <ProtectedRoute path="/habits" component={HabitsPage} />
      <ProtectedRoute path="/calendar" component={CalendarPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { passwordRecovery } = useAuth();

  // After following a reset link, force the "set a new password" screen
  // instead of dropping the recovery session straight into the app.
  if (passwordRecovery) {
    return <UpdatePasswordScreen />;
  }

  return (
    <MainLayout>
      <Router />
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;