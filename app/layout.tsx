import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banking on AI",
  description: "Automated weekly AI in finance newsletter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}