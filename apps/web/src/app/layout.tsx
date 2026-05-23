import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revealth v0.1",
  description: "Autonomous AI software company operating system foundation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

