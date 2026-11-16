import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CaseStudy } from '@/components/work/CaseStudy'
import { PROJECTS, getProject, nextProject } from '@/lib/content/site'

export const dynamicParams = false

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = getProject(slug)
  return p ? { title: `${p.client} — ${p.title}`, description: p.summary } : {}
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = getProject(slug)
  if (!p) notFound()
  return <CaseStudy project={p} next={nextProject(slug)} index={PROJECTS.indexOf(p)} />
}
