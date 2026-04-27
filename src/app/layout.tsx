import type { Metadata } from "next";
import "./globals.css";
import { TurboToastProvider } from "@/components/gba/TurboToastProvider";
import ThemeScript from "@/components/ThemeScript";

export const metadata: Metadata = {
  title: "Web Emulator Lab",
  description: "Web emulator platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <TurboToastProvider>{children}</TurboToastProvider>
      </body>
    </html>
  );
}
