import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security Dashboard',
  description: 'Smart Stadium Security Dashboard portal',
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
