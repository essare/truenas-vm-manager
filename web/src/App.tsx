import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { RouteGuards } from "@/components/route-guards";
import { Toaster } from "@/components/ui/sonner";
import { DashboardPage } from "@/pages/dashboard";
import { OnboardingPage } from "@/pages/onboarding";
import { SetupPage } from "@/pages/setup";
import { UnlockPage } from "@/pages/unlock";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<RouteGuards />}>
            <Route element={<DashboardPage />} path="/" />
            <Route element={<SetupPage />} path="/setup" />
            <Route element={<UnlockPage />} path="/unlock" />
            <Route element={<OnboardingPage />} path="/onboarding" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
