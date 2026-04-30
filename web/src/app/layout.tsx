import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

import { Footer } from "@/components/Footer";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Outfit({
  subsets: ["latin"],
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
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
