import type { Metadata } from "next";
import { M_PLUS_Code_Latin, Press_Start_2P } from "next/font/google";
import "./globals.css";

const code = Press_Start_2P({ subsets: ["latin"], weight: '400' });

export const metadata: Metadata = {
  title: "Tridipedia",
  description: "Journey of a Developer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={code.className + ' h-[100vh] overflow-hidden'}>
        {children}
      </body>
    </html>
  );
}
