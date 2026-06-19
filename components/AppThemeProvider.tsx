"use client";

import type { ReactNode } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0b5cab",
    },
    secondary: {
      main: "#c51f3f",
    },
    success: {
      main: "#138a4b",
    },
    warning: {
      main: "#c17700",
    },
    background: {
      default: "#f3f6fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#172033",
      secondary: "#667085",
    },
    divider: "#d8e0eb",
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  typography: {
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    h1: {
      fontSize: "clamp(1.35rem, 2vw, 1.75rem)",
      fontWeight: 900,
      letterSpacing: "-0.035em",
      lineHeight: 1.05,
    },
    h2: {
      fontSize: "1.5rem",
      fontWeight: 900,
      letterSpacing: "-0.025em",
      lineHeight: 1.1,
    },
    h3: {
      fontSize: "1rem",
      fontWeight: 900,
      letterSpacing: "-0.015em",
      lineHeight: 1.25,
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #d8e0eb",
          borderRadius: 14,
          boxShadow: "none",
          overflow: "hidden",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          "&:last-child": { paddingBottom: 20 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 800 },
        sizeSmall: { height: 26, fontSize: "0.72rem" },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: { maxWidth: "100%" },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 46 },
        indicator: { height: 3, borderRadius: "3px 3px 0 0" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 46,
          minWidth: 92,
          padding: "10px 16px",
          fontSize: "0.82rem",
          fontWeight: 800,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: "#e5eaf1",
          padding: "12px 16px",
          verticalAlign: "middle",
        },
        head: {
          fontWeight: 800,
          color: "#475569",
          backgroundColor: "#f8fafc",
          whiteSpace: "nowrap",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: "#dce7f3" },
      },
    },
  },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
