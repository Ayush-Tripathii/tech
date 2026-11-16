import type { Metadata } from 'next'
import { ServicesPage } from '@/components/services/ServicesPage'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Website design, website development, software and application development, graphic design, video editing, digital and performance marketing.',
}

export default function Page() {
  return <ServicesPage />
}
