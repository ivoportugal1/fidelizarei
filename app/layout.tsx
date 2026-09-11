import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fidelizarei — fidelidade sem aplicativo",
  description: "Programas de fidelidade por QR Code e Wallet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
