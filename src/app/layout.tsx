import Link from "next/link";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EMA T&E Agent",
  description: "Upload, review, and approve expense receipts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-[#f6f0ff] via-[#f9f7ff] to-[#ede8ff] text-[#2a1f4d] min-h-screen`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-white/60 bg-white/80 shadow-sm backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
              <Link href="/" className="text-lg font-semibold tracking-tight text-[#3f2b89]">
                EMA T&E Agent
              </Link>
              <nav className="flex items-center gap-3 text-sm font-medium">
                <Link
                  href="/"
                  className="rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-4 py-2 text-white shadow-lg shadow-[#7c3aed]/20 transition hover:shadow-[#6d28d9]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed]"
                >
                  Upload Receipt
                </Link>
                <Link
                  href="/receipts"
                  className="rounded-full border border-[#c9b6ff] bg-white/70 px-4 py-2 text-[#4c1d95] transition hover:bg-[#ede9fe] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed]"
                >
                  Saved & Submitted
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
