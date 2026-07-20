import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { RouteGuards } from "@/components/route-guards";
import { OnboardingPage } from "@/pages/onboarding";
import { SetupPage } from "@/pages/setup";
import { UnlockPage } from "@/pages/unlock";

const queryClient = new QueryClient();

function DashboardPlaceholder() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">TrueNAS VM Manager</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your dashboard is ready.
        </p>
      </div>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<RouteGuards />}>
            <Route element={<DashboardPlaceholder />} path="/" />
            <Route element={<SetupPage />} path="/setup" />
            <Route element={<UnlockPage />} path="/unlock" />
            <Route element={<OnboardingPage />} path="/onboarding" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
