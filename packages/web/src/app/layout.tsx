import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Nav } from "@/components/nav";
import { RealtimeProvider } from "@/components/realtime-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { getAuthUser } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flashcards",
  description: "Personal quiz and flashcard app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashcards",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#6366f1" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen">
            {user && <Nav />}
            {user && <ServiceWorkerRegister />}
            {user && <RealtimeProvider />}
            <main className={`flex-1 ${user ? "md:pl-16 lg:pl-64 pb-16 md:pb-0" : ""}`}>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
