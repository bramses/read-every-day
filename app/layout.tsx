import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Read Every Day.",
  description: "Track daily reading progress across books",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
