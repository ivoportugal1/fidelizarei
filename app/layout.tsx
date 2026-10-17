import type { Metadata } from "next";
import { Figtree, Outfit } from "next/font/google";
import "./globals.css";
import "./marketing-a.css";
import "./marketing-b.css";
import "./marketing-c.css";
import "./marketing-e.css";
import "./brand.css";

const display = Outfit({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display", display: "swap" });
const text = Figtree({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: "Fidelizarei — clientes fiéis, negócios reais",
  description: "Programa de fidelidade por QR Code e Wallet, sem aplicativo. Mais que pontos: relacionamentos de verdade.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${display.variable} ${text.variable}`}><body>{children}</body></html>;
}
