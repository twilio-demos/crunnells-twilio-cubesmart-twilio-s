import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CubeSmart + Twilio | Guided Move-In Journey",
  description:
    "An interactive showcase of how Twilio's communications platform embeds inside CubeSmart's Management Platform to power an AI-native, multichannel self-storage customer journey — from booking a unit to move-in day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${roboto.variable} antialiased bg-deepspace text-starwhite`}
      >
        {children}
      </body>
    </html>
  );
}
