import type { Metadata, Viewport } from 'next'
import { Inter_Tight, Martian_Mono, Newsreader } from 'next/font/google'
import './globals.css'
import { MotionBoot } from '@/components/system/MotionBoot'
import { Cursor } from '@/components/system/Cursor'
import { Header } from '@/components/system/Header'
import { Preloader } from '@/components/system/Preloader'
import { TransitionShell } from '@/components/system/TransitionShell'
import { Footer } from '@/components/footer/Footer'
import { BRAND } from '@/lib/content/site'

// Variable grotesk, 100–900 axis. next/font emits size-adjusted fallbacks → no CLS on swap.
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" })
const mono = Martian_Mono({ subsets: ['latin'], variable: '--font-martian', display: 'swap', weight: ['300', '400', '500'] })
const editorial = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  weight: ['200'],
  style: ['italic', 'normal'],
  preload: false,
})

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.NODE_ENV === 'production' ? '/tech' : '')

export const metadata: Metadata = {
  metadataBase: new URL('https://gbgtech.com'),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
  description:
    'GBGTech is an engineering-led digital studio in Bhopal, India. Website design & development, software, applications, brand & motion, and performance marketing — engineered to be unforgettable.',
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: 'Engineering-led digital experiences for enterprises and startups.',
    type: 'website',
  },
  icons: { icon: `${basePath}/favicon.svg` },
}

export const viewport: Viewport = {
  themeColor: '#06070A',
  width: 'device-width',
  initialScale: 1,
}

/** Runs before paint: enables JS-only reveal states and flags return visits. */
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{if(sessionStorage.getItem('gbg:visited')==='1')d.classList.add('is-return')}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} ${editorial.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <MotionBoot />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <div id="page">
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </div>
        <TransitionShell />
        <Preloader />
        <Cursor />
      </body>
    </html>
  )
}
