import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vendor App',
  description: 'Smart Stadium Vendor App portal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  )
}
