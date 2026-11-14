import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: { default: "Kingdom Faith Based Hospital", template: "%s | Kingdom Faith Based Hospital" },
  description: "Kingdom Faith Based Hospital management system: patients, clinical care, laboratory, pharmacy, billing and SHA claims.",
};
export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
