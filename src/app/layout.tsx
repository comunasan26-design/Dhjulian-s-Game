import type { Metadata, Viewport } from "next";
import { CardArtDefs } from "@/components/art/CardArt";
import { DragGhost } from "@/components/art/drag";
import { CardZoomHost } from "@/components/art/zoom";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dhjulian's Game — Masmorra de Cartas",
  description: "Jogo de cartas online de masmorra: chute portas, derrote monstros e chegue ao nível 20.",
};

export const viewport: Viewport = {
  themeColor: "#13100e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CardArtDefs />
        {children}
        <CardZoomHost />
        <DragGhost />
      </body>
    </html>
  );
}
