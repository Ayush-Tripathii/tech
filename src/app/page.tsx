import { Hero } from '@/components/home/Hero'
import { Manifesto } from '@/components/home/Manifesto'
import { KeyFacts } from '@/components/home/KeyFacts'
import { ServicesSequence } from '@/components/home/ServicesSequence'
import { HelixGallery } from '@/components/home/HelixGallery'
import { Testimonials } from '@/components/home/Testimonials'
import { ContactForm } from '@/components/home/ContactForm'

export default function Home() {
  return (
    <>
      <Hero />
      <Manifesto />
      <KeyFacts />
      <ServicesSequence />
      <HelixGallery />
      <Testimonials />
      <ContactForm />
    </>
  )
}
