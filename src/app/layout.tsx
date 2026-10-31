import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReelMind — Turn videos into knowledge",
  description: "Transcribe videos, generate structured notes, and create shareable visual summaries — in English or Urdu.",
  keywords: ["video to notes", "AI learning", "transcription", "Urdu notes", "bilingual notes", "infographic", "knowledge"],
  authors: [{ name: "ReelMind" }],
  icons: {
  icon: "/icon.png",
},
  openGraph: {
    title: "ReelMind — Turn videos into knowledge",
    description: "Transcribe videos, generate structured notes, and create shareable visual summaries — in English or Urdu.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
