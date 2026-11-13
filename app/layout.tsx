import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Półkolonie RoboPlanet", template: "%s · RoboPlanet" },
  description: "Zapisy na półkolonie RoboPlanet",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
