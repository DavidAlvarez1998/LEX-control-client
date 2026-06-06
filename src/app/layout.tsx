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
  title: "LEX Control · Cliente",
  description: "Portal de clientes de LEX Control",
};

// Aplica el tema antes del primer pintado para evitar parpadeo (FOUC).
// Debe ser autónomo (sin imports); la clave coincide con THEME_KEY de lib/theme.ts.
const themeScript = `(function(){try{var t=localStorage.getItem('lex-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
