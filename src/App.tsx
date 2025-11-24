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

import { UnderConstruction } from "./pages/placeholder";
import HomePage from "./pages/home";
import AppointmentDetailsPage from "./pages/home/appointment";
import PatientSearchPage from "./pages/patient-search";
import ExpensesListPage from "./pages/expenses";

// 🔥 SUPABASE
import { dataProvider } from "@refinedev/supabase";
import { supabase } from "./utility/supabaseClient";

function App() {
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
                      <MobileSidebarProvider>
                        <ThemedLayout
                          Header={() => <Header sticky />}
                          Sider={() => <Sidebar />}
                        >
                          <Outlet />
                        </ThemedLayout>
                      </MobileSidebarProvider>
                    }
                  >
                    <Route index element={<Navigate to="/home" replace />} />
                    <Route path="home" element={<HomePage />} />
                    <Route
                      path="home/appointments/:id"
                      element={<AppointmentDetailsPage />}
                    />
                    <Route path="patient-search" element={<PatientSearchPage />} />
                    <Route path="expenses" element={<ExpensesListPage />} />
                    <Route path="*" element={<UnderConstruction />} />
                  </Route>
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
