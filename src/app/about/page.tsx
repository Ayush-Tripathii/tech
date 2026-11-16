import type { Metadata } from 'next'
import { AboutPage } from '@/components/about/AboutPage'

export const metadata: Metadata = {
  title: 'About',
  description: 'GBGTech is an engineering-led studio founded in 2020 in Bhopal, India.',
}

export default function Page() {
  return <AboutPage />
}
