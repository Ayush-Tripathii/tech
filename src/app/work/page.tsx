import type { Metadata } from 'next'
import { WorkIndex } from '@/components/work/WorkIndex'

export const metadata: Metadata = {
  title: 'Work',
  description: 'Selected platforms, websites, applications, brand films and growth programmes engineered by GBGTech.',
}

export default function WorkPage() {
  return <WorkIndex />
}
