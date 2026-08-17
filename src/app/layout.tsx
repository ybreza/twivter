import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Twivter — Connect. Share. Discover.",
  description:
    "Twivter adalah platform social media modern tempat kamu terhubung, berbagi ide, dan menemukan komunitas. Built with Next.js 16.",
  keywords: ["Twivter", "social media", "Next.js", "twitter", "microblog"],
  authors: [{ name: "Twivter Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Twivter — Connect. Share. Discover.",
    description: "Platform social media modern yang cepat & nyata.",
    siteName: "Twivter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Twivter",
    description: "Platform social media modern yang cepat & nyata.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="bottom-center" />
      </body>
    </html>
  );
}
