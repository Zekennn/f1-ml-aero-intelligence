import { Barlow_Condensed, JetBrains_Mono } from "next/font/google";

/** Display + HUD fonts used only on the motion landing page. */
export const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });
