import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistMono = localFont({
  src: "./DepartureMono-Regular.woff2",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Excella",
  description: "The first AI data analyst that lives inside your spreadsheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.className} ${geistMono.variable} antialiased`}
      >
        {/* Cache history methods before Office.js patches them */}
        <Script id="excella-history-cache" strategy="beforeInteractive">
          {`
            (function () {
              if (typeof window === 'undefined' || !window.history) return;
              var h = window.history;
              window.__excellaHistoryCache = {
                replaceState: typeof h.replaceState === 'function' ? h.replaceState.bind(h) : null,
                pushState: typeof h.pushState === 'function' ? h.pushState.bind(h) : null,
              };
            })();
          `}
        </Script>
        {/* Load Office.js so Excel.run / Office APIs are available in the taskpane */}
        <Script
          src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
          strategy="beforeInteractive"
        />
        {/* Restore history methods that Office.js may have disabled */}
        <Script id="excella-history-restore" strategy="beforeInteractive">
          {`
            (function () {
              if (typeof window === 'undefined' || !window.history) return;
              var cache = (window.__excellaHistoryCache || {});
              if (cache.replaceState) window.history.replaceState = cache.replaceState;
              if (cache.pushState) window.history.pushState = cache.pushState;
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
