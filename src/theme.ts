import { alpha, createTheme, responsiveFontSizes } from "@mui/material/styles";
import type { PaletteMode, Theme } from "@mui/material/styles";
import { RefineThemes } from "@refinedev/mui";

const fontStack =
  "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";


export function getAppTheme(mode: PaletteMode | string): Theme {
  const m = (mode === "dark" ? "dark" : "light") as PaletteMode;
  const base = m === "light" ? RefineThemes.Blue : RefineThemes.BlueDark;

  // Derive tokens from base to keep compatibility with Refine defaults
  const primary = base.palette.primary.main;
  const backgroundPaper = base.palette.background.paper;
  const backgroundDefault = base.palette.background.default;

  let theme = createTheme({
    ...base,
    breakpoints: {
      values: { xs: 0, sm: 360, md: 768, lg: 1200, xl: 1536 },
    },
    palette: {
      ...base.palette,
      mode: m,
      // Fine-tune neutrals and accents for a calmer, designer look
      primary: {
        ...base.palette.primary,
        main: base.palette.primary.main,
        light: base.palette.primary.light,
        dark: base.palette.primary.dark,
      },
      secondary: {
        ...base.palette.secondary,
        main: base.palette.secondary.main,
      },
      background: {
        default: backgroundDefault,
        paper: backgroundPaper,
      },
      divider: alpha(base.palette.primary.main, m === "dark" ? 0.18 : 0.12),
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      ...base.typography,
      fontFamily: fontStack,
      h1: { fontWeight: 700, letterSpacing: -0.5 },
      h2: { fontWeight: 700, letterSpacing: -0.5 },
      h3: { fontWeight: 700, letterSpacing: -0.4 },
      h4: { fontWeight: 700, letterSpacing: -0.3 },
      h5: { fontWeight: 700, letterSpacing: -0.2 },
      h6: { fontWeight: 700, letterSpacing: -0.15 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: "none", letterSpacing: 0.2 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            colorScheme: m,
          },
          body: {
            margin: 0,
            overflowX: "hidden",
            WebkitTapHighlightColor: "transparent",
            backgroundImage:
              m === "dark"
                ? "linear-gradient(180deg, rgba(15,18,24,0.9), rgba(15,18,24,0.9)), radial-gradient(1200px 600px at 0% 0%, rgba(67,97,238,0.06), transparent)"
                : "radial-gradient(1200px 600px at 0% 0%, rgba(67,97,238,0.06), transparent)",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: "default" },
        styleOverrides: {
          root: {
            backdropFilter: "saturate(180%) blur(10px)",
            backgroundColor:
              m === "dark"
                ? alpha(backgroundPaper, 0.75)
                : alpha("#ffffff", 0.7),
            borderBottom: `1px solid ${alpha(primary, m === "dark" ? 0.22 : 0.12)}`,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 56,
            "@media (min-width:768px)": {
              minHeight: 64,
            },
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: `1px solid ${alpha(primary, m === "dark" ? 0.18 : 0.1)}`,
            backgroundImage: "none",
            transition: "box-shadow .2s ease, transform .2s ease",
            "&:hover": {
              boxShadow:
                m === "dark"
                  ? "0 8px 28px rgba(0,0,0,0.35)"
                  : "0 8px 28px rgba(2,6,23,0.08)",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
          containedPrimary: {
            backgroundImage:
              "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.06))",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: "background-color .15s ease, transform .1s ease",
            "&:active": {
              transform: "translateY(0.5px)",
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderLeft: `1px solid ${alpha(primary, m === "dark" ? 0.18 : 0.1)}`,
            backgroundImage: "none",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            opacity: 0.9,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: alpha(primary, m === "dark" ? 0.18 : 0.1),
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: "small",
        },
      },
      MuiIconButton: {
        defaultProps: {
          size: "small",
        },
      },
    },
  });

  // Make typography responsive
  theme = responsiveFontSizes(theme, { factor: 2.6 });

  return theme;
}
