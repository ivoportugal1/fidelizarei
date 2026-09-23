import type { Metadata } from "next";
import "./globals.css";
import "./marketing-a.css";
import "./marketing-b.css";
import "./marketing-c.css";

export const metadata: Metadata = {
  title: "Fidelizarei — fidelidade sem aplicativo",
  description: "Programas de fidelidade por QR Code e Wallet.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
