import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/session-provider";

const inter = localFont({
  src: "./fonts/inter-latin-400.woff2",
  variable: "--font-inter",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReelMind — Turn videos into knowledge",
  description: "Transcribe videos, generate structured notes, and create shareable visual summaries — in English. Urdu. Hinglish",
  keywords: ["video to notes", "AI learning", "transcription", "Urdu notes", "bilingual notes", "infographic", "knowledge"],
  authors: [{ name: "ReelMind" }],
  icons: {
  icon: "/icon.png",
},
  openGraph: {
    title: "ReelMind — Turn videos into knowledge",
    description: "Transcribe videos, generate structured notes, and create shareable visual summaries — in English. Urdu. Hinglish.",
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
        <AuthSessionProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
