import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ReactNode } from 'react'
import './globals.css'

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: 'ft_transcendence - Collaborative Workspace with 2D Metaverse',
  description: 'A modern SaaS platform where teams manage work inside a virtual office',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
