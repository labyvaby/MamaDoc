import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import { useGetIdentity } from "@refinedev/core";
import { RefineThemedLayoutHeaderProps } from "@refinedev/mui";
import React, { useContext, useEffect, useState } from "react";
import { ColorModeContext } from "../../contexts/color-mode";
import { useMobileSidebar } from "../sidebar/mobile-context";
import { useNavigate } from "react-router";
import { supabase } from "../../utility/supabaseClient";
import { InputAdornment, TextField } from "@mui/material";
import SearchOutlined from "@mui/icons-material/SearchOutlined";

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const { mode, setMode } = useContext(ColorModeContext);
  const { data: user } = useGetIdentity<IUser>();
  const { toggle } = useMobileSidebar();
  const navigate = useNavigate();
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setAuthEmail(data?.user?.email ?? null);
      } catch {
        // ignore
      }

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setAuthEmail(session?.user?.email ?? null);
        }
      );
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  function setQuery(value: string): void {
    throw new Error("Function not implemented.");
  }

  return (
    <AppBar
      position={sticky ? "sticky" : "relative"}
      color="default"
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        color: (theme) => theme.palette.text.primary,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
      elevation={0}
    >
      <Toolbar sx={{ position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            pointerEvents: "none",
          }}
        >
          <FavoriteBorderOutlined color="primary" sx={{ fontSize: 24 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              letterSpacing: ".02em",
              userSelect: "none",
              display: { xs: "none", sm: "inline-flex" },
            }}
          >
            Мама Доктор
          </Typography>
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            sx={{ width: { xs: 1, md: "auto" } }}
          >
            <TextField
              size="small"
              placeholder="Поиск"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              }}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ width: { xs: 1, md: 260 } }}
            />
          </Stack>
        </Box>
        <Stack
          direction="row"
          width="100%"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton
              color="inherit"
              onClick={toggle}
              aria-label="Открыть меню"
              sx={{ display: { xs: "inline-flex", md: "none" } }}
            >
              <MenuOutlined />
            </IconButton>
          </Stack>

          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton
              color="inherit"
              onClick={() => {
                setMode();
              }}
              aria-label="Toggle color mode"
            >
              {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>

            <IconButton
              color="inherit"
              onClick={handleLogout}
              aria-label="Выйти"
              title={authEmail ? `Выйти (${authEmail})` : "Выйти"}
            >
              <LogoutOutlined />
            </IconButton>

            {(user?.avatar || user?.name) && (
              <Stack
                direction="row"
                gap="12px"
                alignItems="center"
                justifyContent="center"
              >
                {user?.name && (
                  <Typography
                    sx={{
                      display: { xs: "none", sm: "inline-block" },
                    }}
                    variant="subtitle2"
                  >
                    {user?.name}
                  </Typography>
                )}
                <Avatar src={user?.avatar} alt={user?.name} />
              </Stack>
            )}
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
