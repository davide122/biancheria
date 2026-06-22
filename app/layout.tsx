import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contatore Lavanderia",
  description: "Mini web app per gestire il conteggio della biancheria.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
