import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: {
    default: "Digital Ocarina",
    template: "%s — Digital Ocarina",
  },
  description:
    "Web companion for the Digital Ocarina voice-to-instrument synthesizer. Browse 4,886 orchestral samples, manage kits, sync recordings, and explore with AI-powered search.",
  openGraph: {
    title: "Digital Ocarina",
    description: "Your instrument, in the cloud. Browse orchestral samples, build kits with AI, sync recordings from your Ocarina.",
    siteName: "Digital Ocarina",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Ocarina",
    description: "Voice-to-instrument synthesizer with 4,886 orchestral samples and AI-powered kit building.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
