import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { RegisterServiceWorker } from "@/components/pwa";

export const metadata: Metadata = {
  title: { default: "Kingdom Faith Based Hospital", template: "%s | Kingdom Faith Based Hospital" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Kingdom Hospital", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
  description: "Kingdom Faith Based Hospital management system: patients, clinical care, laboratory, pharmacy, billing and SHA claims.",
};
export const viewport: Viewport = { themeColor: "#2a6fae", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
