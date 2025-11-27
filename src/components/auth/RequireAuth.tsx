import React from "react";
import { Navigate, useLocation } from "react-router";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import { supabase } from "../../utility/supabaseClient";

type Props = {
  children: React.ReactNode;
};

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setAuthenticated(!!data?.session);
      } finally {
        setLoading(false);
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthenticated(!!session);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      try {
        if (typeof unsub === "function") unsub();
      } catch {
        // ignore
      }
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ px: 2, pt: 1 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!authenticated) {
    const to = location.pathname + location.search;
    return <Navigate to={`/login?to=${encodeURIComponent(to)}`} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
