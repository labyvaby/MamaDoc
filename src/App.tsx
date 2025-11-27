import { Refine } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";

import { BrowserRouter, Outlet, Route, Routes, Navigate } from "react-router";

import { Header } from "./components/header";
import { Sidebar } from "./components/sidebar";
import { MobileSidebarProvider } from "./components/sidebar/mobile-context";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { RequireAuth } from "./components/auth/RequireAuth";

import { lazy, Suspense, useEffect } from "react";
const UnderConstruction = lazy(() =>
  import("./pages/placeholder").then((m) => ({ default: m.UnderConstruction })),
);
const HomePage = lazy(() => import("./pages/home"));
const AppointmentDetailsPage = lazy(() => import("./pages/home/appointment"));
import PatientSearchPage from "./pages/patient-search";
const ExpensesListPage = lazy(() => import("./pages/expenses"));
const EmployeesPage = lazy(() => import("./pages/employees"));
const ServicesPage = lazy(() => import("./pages/services"));
const LoginPage = lazy(() => import("./pages/auth/login"));

// 🔥 SUPABASE
import { dataProvider } from "@refinedev/supabase";
import { supabase } from "./utility/supabaseClient";
import LinearProgress from "@mui/material/LinearProgress";

function App() {
  useEffect(() => {
    const prefetch = () => {
      import("./pages/home");
      import("./pages/expenses");
      import("./pages/employees");
      import("./pages/services");
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    const ric = w.requestIdleCallback;
    if (typeof ric === "function") {
      ric(prefetch);
    } else {
      setTimeout(prefetch, 1500);
    }
  }, []);
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <CssBaseline />
          <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />

          <RefineSnackbarProvider>
              <Refine
                dataProvider={dataProvider(supabase)}
                notificationProvider={useNotificationProvider}
                routerProvider={routerProvider}
                resources={[
                  {
                    name: '"Appointments"',
                    list: "/home",
                    show: "/home/appointments/:id",
                  },
                  {
                    name: "categories",
                    list: "/categories",
                    create: "/categories/create",
                    edit: "/categories/edit/:id",
                    show: "/categories/show/:id",
                    meta: { canDelete: true },
                  },
                  {
                    name: "expenses",
                    list: "/expenses",
                  },
                  {
                    name: "services",
                    list: "/services",
                  },
                  {
                    name: "employees",
                    list: "/employees",
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  projectId: "Ajscvf-43VuiP-CaKNwq",
                }}
              >
                <Routes>
                  <Route
                    element={
                      <RequireAuth>
                        <MobileSidebarProvider>
                        <ThemedLayout
                          Header={() => <Header sticky />}
                          Sider={() => <Sidebar />}
                        >
                          <Outlet />
                        </ThemedLayout>
                        </MobileSidebarProvider>
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Navigate to="/home" replace />} />
                    <Route
                      path="home"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <HomePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="home/appointments/:id"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <AppointmentDetailsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="patient-search"
                      element={<PatientSearchPage />}
                    />
                    <Route
                      path="expenses"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <ExpensesListPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="employees"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <EmployeesPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="services"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <ServicesPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <Suspense fallback={<LinearProgress />}>
                          <UnderConstruction />
                        </Suspense>
                      }
                    />
                  </Route>
                <Route
                  path="login"
                  element={
                    <Suspense fallback={<LinearProgress />}>
                      <LoginPage />
                    </Suspense>
                  }
                />
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>

          </RefineSnackbarProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
