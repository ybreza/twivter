import type { Metadata, Viewport } from "next";
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

/**
 * `themeColor` and `viewport` moved out of `metadata` and into the `viewport`
 * export: Next.js 14+ deprecates them there, and this build warns about it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the notch/home indicator; the shell pads itself
  // with env(safe-area-inset-*). Without this, `standalone` apps on iPhone get a
  // letterboxed strip and a status bar that does not match the theme colour.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export const metadata: Metadata = {
  title: "Twivter — Connect. Share. Discover.",
  description:
    "Twivter adalah platform social media modern tempat kamu terhubung, berbagi ide, dan menemukan komunitas. Built with Next.js 16.",
  keywords: ["Twivter", "social media", "Next.js", "twitter", "microblog"],
  authors: [{ name: "Twivter Team" }],
  applicationName: "Twivter",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    // iOS ignores manifest icons entirely and only reads this link.
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Without this, iOS turns phone numbers and addresses in bios into tap targets.
  formatDetection: { telephone: false, address: false, email: false },
  // Enables the standalone display mode on iOS. Chrome reads `display` from the
  // manifest instead; both are needed for the app to launch full-screen.
  appleWebApp: {
    capable: true,
    title: "Twivter",
    // `default` keeps the status bar readable on both light and dark themes;
    // `black-translucent` would need the safe-area padding below.
    statusBarStyle: "default",
  },
  other: {
    // Next 16 renders `appleWebApp.capable` as `mobile-web-app-capable`, which
    // iOS ignores — it only reads `apple-mobile-web-app-capable`. Without this
    // tag "Add to Home Screen" launches the site in a Safari chrome-less view
    // but not as a standalone app, so the tag is set explicitly.
    "apple-mobile-web-app-capable": "yes",
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
