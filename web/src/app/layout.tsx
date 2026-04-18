import type { Metadata } from "next";
import { Outfit, Cormorant_Garamond } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Home Seek | Real-Time Rental Sniper",
  description: "Advanced AI-powered rental tracking for South Africa. Get instant notifications for new listings on Property24, Facebook, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`} suppressHydrationWarning>
      <body
        className={`antialiased min-h-screen bg-[#050505] text-white font-sans`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
