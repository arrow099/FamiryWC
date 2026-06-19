import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppThemeProvider } from "@/components/AppThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Famiry 2026 Bracket Challenge",
  description: "Private World Cup bracket dashboard for family and friends.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
