import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import Chrome from "@/components/motion/Chrome";
import { display, mono } from "@/components/motion/fonts";
import AutoReveal from "@/components/site/AutoReveal";
import "./globals.css";
import "./navbar.css";
import "./footer.css";
import "./calendar.css";
import "./windtunnel.css";
import "./telemetry.css";
import "./insights.css";
import "./predictor.css";
import "./theme.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Fan Hub | Racing Fan Site", template: "%s | Fan Hub" },
  description: "An unofficial fan site covering teams, drivers, the race calendar, live telemetry and race predictions.",
};

export const viewport: Viewport = { themeColor: "#03070e", colorScheme: "dark" };

/** Shared shell for every page: navbar on top, footer at the bottom, motion chrome everywhere. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <SmoothScroll />
        <AutoReveal />
        <Chrome />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
