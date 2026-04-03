import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import BottomNav from "@/components/Navigation/BottomNav";
import AuthModal from "@/components/Auth/AuthModal";
import AuthProvider from "@/components/Auth/AuthProvider";
import AuthGuard from "@/components/Auth/AuthGuard";
import NotifProvider from "@/components/Providers/NotifProvider";
import ErrorBoundary from "@/components/Providers/ErrorBoundary";
import PerfProvider from "@/components/Providers/PerfProvider";
import { Toaster } from "react-hot-toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: 'swap',
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "TikTok Clone - Pour toi",
  description: "Découvrez les meilleures vidéos courtes sur TikTok Clone. Partagez, aimez et commentez des vidéos créatives.",
  keywords: ["tiktok", "vidéos courtes", "social media", "partage vidéo"],
  authors: [{ name: "TikTok Clone" }],
  openGraph: {
    title: 'TikTok Clone - Pour toi',
    description: 'Découvrez les meilleures vidéos courtes',
    type: 'website',
    siteName: 'TikTok Clone',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-black text-white h-[100dvh] overflow-hidden selection:bg-tiktok-pink/30 antialiased`}>
        <ErrorBoundary>
          <PerfProvider>
          <AuthProvider>
             <Toaster 
               position="top-center" 
               containerStyle={{ zIndex: 9999 }}
               toastOptions={{
                 style: { 
                   background: '#121212', 
                   color: '#fff', 
                   border: '1px solid #333',
                   borderRadius: '12px',
                   fontSize: '14px',
                 } 
               }} 
             />
             <AuthGuard>
                <NotifProvider>
                   <main className="h-full w-full max-w-[500px] mx-auto relative overflow-hidden bg-black shadow-2xl shadow-white/5">
                     {children}
                   </main>
                   <BottomNav />
                   <AuthModal />
                </NotifProvider>
             </AuthGuard>
          </AuthProvider>
          </PerfProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
