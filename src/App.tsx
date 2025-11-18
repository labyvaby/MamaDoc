import { Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import routerProvider, { DocumentTitleHandler, UnsavedChangesNotifier } from "@refinedev/react-router";
import dataProvider from "@refinedev/simple-rest";
import { BrowserRouter, Outlet, Route, Routes, Navigate } from "react-router";
import { Header } from "./components/header";
import { Sidebar } from "./components/sidebar";
import { MobileSidebarProvider } from "./components/sidebar/mobile-context";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { UnderConstruction } from "./pages/placeholder";
import HomePage from "./pages/home";
import AppointmentDetailsPage from "./pages/home/appointment";
function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <CssBaseline />
          <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
          <RefineSnackbarProvider>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider("https://api.fake-rest.refine.dev")}
                notificationProvider={useNotificationProvider}
                routerProvider={routerProvider}
                resources={[
                  {
                    name: "blog_posts",
                    list: "/blog-posts",
                    create: "/blog-posts/create",
                    edit: "/blog-posts/edit/:id",
                    show: "/blog-posts/show/:id",
                    meta: {
                      canDelete: true,
                    },
                  },
                  {
                    name: "categories",
                    list: "/categories",
                    create: "/categories/create",
                    edit: "/categories/edit/:id",
                    show: "/categories/show/:id",
                    meta: {
                      canDelete: true,
                    },
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
                        <ThemedLayout Header={() => <Header sticky />} Sider={() => <Sidebar />}>
                          <Outlet />
                        </ThemedLayout>
                      </MobileSidebarProvider>
                    }
                  >
                    <Route index element={<Navigate to="/home" replace />} />
                    <Route path="home" element={<HomePage />} />
                    <Route path="home/appointments/:id" element={<AppointmentDetailsPage />} />
                    <Route path="*" element={<UnderConstruction />} />
                  </Route>
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </RefineSnackbarProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
