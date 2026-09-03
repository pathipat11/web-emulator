import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Emulator Lab",
  description: "Web emulator platform",
};

const themeScript = `
  (function () {
    try {
      var theme = localStorage.getItem("theme");
      if (theme !== "light" && theme !== "dark") theme = "dark";
      document.documentElement.dataset.theme = theme;
    } catch (error) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
