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
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow">
              {children}
            </main>
            <footer className="py-12 border-t border-white/5 text-center bg-[#050505]">
              <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">Home-Seek Intelligence Core &copy; 2026</p>
              <div className="mt-4 flex justify-center gap-6">
                <a href="#" className="text-[8px] font-bold text-white/20 uppercase tracking-widest hover:text-white transition-all">Terms of Service</a>
                <a href="#" className="text-[8px] font-bold text-white/20 uppercase tracking-widest hover:text-white transition-all">Privacy Policy</a>
                <a href="/admin" className="text-[8px] font-bold text-white/5 uppercase tracking-widest hover:text-white transition-all">Command Center</a>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
