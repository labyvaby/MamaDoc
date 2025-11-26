import React, { useEffect } from "react";
import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  IconButton,
} from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, alpha } from "@mui/material/styles";


import HomeOutlined from "@mui/icons-material/HomeOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
// import LocalHospitalOutlined from "@mui/icons-material/LocalHospitalOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import MedicalServicesOutlined from "@mui/icons-material/MedicalServicesOutlined";
// import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
// import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
// import BlockOutlined from "@mui/icons-material/BlockOutlined";
// import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
// import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";

import { useThemedLayoutContext } from "@refinedev/mui";
import { Link as RouterLink, useLocation } from "react-router";
import { useMobileSidebar } from "./mobile-context";

// Sidebar root that ThemedLayout will render via Sider={() => <Sidebar />}
export const Sidebar: React.FC = () => {
  return (
    <SidebarContainer>
      <SidebarHeader />
      <Divider sx={{ my: 1 }} />
      <SidebarSecondary />
      <Divider sx={{ my: 1 }} />
      <SidebarFooter />
    </SidebarContainer>
  );
};

// Container responsible for width/collapsed behavior
const SidebarContainer: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // mobile-only open state comes from shared header/sidebar context
  const { mobileOpen, setMobileOpen } = useMobileSidebar();

  const desktopWidth = siderCollapsed ? 64 : 260;
  const overlayWidth = 260;

  // Ensure layout stays collapsed on mobile to prevent content shift
  useEffect(() => {
    if (isMobile && !siderCollapsed) {
      setSiderCollapsed?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original || "";
      };
    }
    return;
  }, [isMobile, mobileOpen]);

  return (
    <>
      {/* Backdrop behind the sidebar on mobile */}
      <Backdrop
        open={Boolean(isMobile && mobileOpen)}
        onClick={() => setMobileOpen(false)}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 3 }}
      />

      {/* Layout participant wrapper ensures no width on mobile */}
      <Box sx={{ width: { xs: 0, md: desktopWidth } }}>
        {/* Desktop sidebar (sticky, participates in layout) */}
        <Box
          component="nav"
          sx={{
            display: { xs: "none", md: "block" },
            width: "100%",
            bgcolor: "background.paper",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            height: "100vh",
            position: "sticky",
            top: 0,
          p: 1,
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Stack height="100%" justifyContent="space-between">
            <Box>{children}</Box>
          </Stack>
        </Box>
      </Box>

      {/* Mobile overlay sidebar (fixed, does not affect layout) */}
      <Box
        component="nav"
        sx={{
          display: { xs: "block", md: "none" },
          width: overlayWidth,
          bgcolor: "background.paper",
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          p: 1,
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          zIndex: (theme) => theme.zIndex.drawer + 5,
          boxShadow: 8,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: (theme) =>
            theme.transitions.create(["transform"], {
              duration: 250,
              easing: theme.transitions.easing.easeInOut,
            }),
        }}
      >
        <Stack height="100%" justifyContent="space-between">
          <Box>{children}</Box>
        </Stack>
      </Box>
    </>
  );
};

// Top area (logo/title)
const SidebarHeader: React.FC = () => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { mobileOpen, setMobileOpen } = useMobileSidebar();

  const open = isMobile ? mobileOpen : !siderCollapsed;

  const handleClick = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setSiderCollapsed?.(!siderCollapsed);
    }
  };

  return (
    <Box sx={{ display: { xs: "none", md: "flex" } }} justifyContent="center" py={1}>
      <Tooltip title={open ? "Скрыть меню" : "Открыть меню"} placement="right">
        <IconButton onClick={handleClick} size="small">
          <MenuOutlined />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// Extra static sections: mimic the provided design with many items
const SidebarSecondary: React.FC = () => {
  const { siderCollapsed } = useThemedLayoutContext();
  return (
    <>
      <List sx={{ py: 0 }}>
        <SidebarMenuItem to="/home" icon={<HomeOutlined />} label="Главная" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/patient-search" icon={<SearchOutlined />} label="Поиск пациента" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/expenses" icon={<PaymentsOutlined />} label="Расходы" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/employees" icon={<BadgeOutlined />} label="Сотрудники" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/services" icon={<MedicalServicesOutlined />} label="Услуги" collapsed={siderCollapsed} />
        {/* <SidebarMenuItem to="/doctor-visits" icon={<LocalHospitalOutlined />} label="Приемы для врачей" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/cash" icon={<PaymentsOutlined />} label="Касса" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/access" icon={<BadgeOutlined />} label="СКУД" collapsed={siderCollapsed} />
        // <SidebarMenuItem to="/expenses" icon={<PaymentsOutlined />} label="Расходы" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/by-doctor" icon={<CalendarMonthOutlined />} label="Приемы по докторам" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/by-day" icon={<CalendarMonthOutlined />} label="Приемы по дням" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/procedures" icon={<ScienceOutlined />} label="Все процедуры" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/salaries" icon={<AnalyticsOutlined />} label="Зарплаты" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/employees" icon={<BadgeOutlined />} label="Сотрудники" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/services" icon={<LocalHospitalOutlined />} label="Услуги" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/products" icon={<Inventory2Outlined />} label="Товары" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/products-sales" icon={<AnalyticsOutlined />} label="Продажи товаров" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/warehouse" icon={<Inventory2Outlined />} label="Склад" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/blacklist" icon={<BlockOutlined />} label="Черный список" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/diagnoses" icon={<ScienceOutlined />} label="Диагнозы" collapsed={siderCollapsed} />
        <SidebarMenuItem to="/tests" icon={<ScienceOutlined />} label="Анализы" collapsed={siderCollapsed} /> */}
      </List>
    </>
  );
};

// Reusable item with tooltip-on-collapse
type SidebarMenuItemProps = {
  to: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  selected?: boolean;
  collapsed?: boolean;
};

const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
  to,
  icon,
  label,
  selected,
  collapsed,
}) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const collapsedFinal = (collapsed ?? false) && !isMobile;
  const isActive = selected ?? (location.pathname === to || location.pathname.startsWith(to + "/"));

  const text = (
    <Box
      sx={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        opacity: collapsedFinal ? 0 : 1,
        width: collapsedFinal ? 0 : "auto",
        transition: (theme) => theme.transitions.create(["opacity", "width", "margin"], { duration: 200 }),
        ml: collapsedFinal ? 0 : 1,
      }}
    >
      <ListItemText primary={label} />
    </Box>
  );

  const button = (
    <ListItem disablePadding>
      <ListItemButton
        component={RouterLink}
        to={to}
        selected={isActive}
        sx={{
          borderRadius: 4,
          my: 0.5,
          px: 1.4,
          color: (theme) => (isActive ? theme.palette.primary.main : undefined),
          '& .MuiListItemIcon-root': {
            color: (theme) => (isActive ? theme.palette.primary.main : undefined),
          },
          bgcolor: (theme) =>
            isActive
              ? (theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.22)
                  : alpha(theme.palette.primary.main, 0.08))
              : 'transparent',
          '&:hover': {
            bgcolor: (theme) =>
              isActive
                ? (theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.28)
                    : alpha(theme.palette.primary.main, 0.12))
                : theme.palette.action.hover,
          },
        }}
      >
        {icon && <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>}
        {text}
      </ListItemButton>
    </ListItem>
  );

  if (collapsedFinal) {
    return (
      <Tooltip title={label} placement="right">
        <Box>{button}</Box>
      </Tooltip>
    );
  }

  return button;
};

// Bottom area (copyright / version)
const SidebarFooter: React.FC = () => {
  const { siderCollapsed } = useThemedLayoutContext();
  return (
    <Box px={1} py={1.5}>
      {siderCollapsed ? (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
          v0.1
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" display="block">
            MamaDoc v0.1.0
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            © {new Date().getFullYear()}
          </Typography>
        </>
      )}
    </Box>
  );
};
