import { AppShell } from "@/components/AppShell";
import { AppToaster } from "@/components/AppToaster";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
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
  title: "Sales Buddy",
  description: "Sales Buddy",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full min-h-full flex flex-col">
        <ClerkProvider>
          <AppToaster />
          <Suspense fallback={null}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </ClerkProvider>
      </body>
    </html>
  );
}
