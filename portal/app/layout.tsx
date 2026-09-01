import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "PSNA Teacher Analytics Portal",
  description: "Secure PSNA faculty analytics for Maths.Engineering content progress, online tests and learner support.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "PSNA Teacher Analytics Portal",
    description: "Secure content progress and online test analytics for approved PSNA faculty.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "PSNA Teacher Analytics Portal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PSNA Teacher Analytics Portal",
    description: "Secure content progress and online test analytics for approved PSNA faculty.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
