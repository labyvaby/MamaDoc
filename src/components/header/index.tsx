import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import { useGetIdentity } from "@refinedev/core";
import { RefineThemedLayoutHeaderProps } from "@refinedev/mui";
import React, { useContext } from "react";
import { ColorModeContext } from "../../contexts/color-mode";
import { useMobileSidebar } from "../sidebar/mobile-context";

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
      <Toolbar>
        <Stack direction="row" width="100%" alignItems="center" justifyContent="space-between" gap={1}>
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

            {(user?.avatar || user?.name) && (
              <Stack direction="row" gap="12px" alignItems="center" justifyContent="center">
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
