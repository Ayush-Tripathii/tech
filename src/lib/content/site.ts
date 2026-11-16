/**
 * Site content. Proof points, clients, projects and testimonials are
 * PLACEHOLDERS (fictional companies) — replace before launch.
 */

export const BRAND = {
  name: 'GBGTech',
  tagline: 'Engineering the Future.',
  taglineWords: ['Engineering', 'the', 'Future.'] as const,
  mission: 'We engineer unforgettable digital experiences.',
  verbs: ['design', 'engineer', 'scale'] as const,
  founded: 2020,
  city: 'Bhopal',
  country: 'India',
  timezone: 'Asia/Kolkata',
  email: 'hello@gbgtech.com',
  phone: '+91 00000 00000',
  coords: '23.2599° N, 77.4126° E',
  social: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
    { label: 'Instagram', href: 'https://www.instagram.com/' },
    { label: 'Behance', href: 'https://www.behance.net/' },
    { label: 'GitHub', href: 'https://github.com/' },
  ],
} as const

export const NAV = [
  { label: 'Work', href: '/work/' },
  { label: 'Services', href: '/services/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/#contact' },
] as const

export interface Service {
  id: string
  index: string
  title: string
  short: string
  body: string
  covers: string[]
  stack: string[]
}

/** Eight offerings grouped into six engineered pillars. */
export const SERVICES: Service[] = [
  {
    id: 'experience-design',
    index: '01',
    title: 'Experience Design',
    short: 'Interfaces with intent.',
    body: 'Website and product design built on research, systems thinking and motion that explains, not decorates.',
    covers: ['Website design', 'Product UI/UX', 'Design systems'],
    stack: ['Figma', 'Principle', 'Rive'],
  },
  {
    id: 'web-engineering',
    index: '02',
    title: 'Web Engineering',
    short: 'Fast is a feature.',
    body: 'Performance-budgeted website development — headless, WebGL-driven and accessible by default.',
    covers: ['Website development', 'Headless CMS', 'WebGL & 3D'],
    stack: ['Next.js', 'Three.js', 'GSAP', 'Sanity'],
  },
  {
    id: 'software-platforms',
    index: '03',
    title: 'Software Platforms',
    short: 'Systems that scale.',
    body: 'Custom software development: SaaS platforms, internal tools and APIs engineered for the next 10× of load.',
    covers: ['Software development', 'SaaS & APIs', 'Cloud architecture'],
    stack: ['TypeScript', 'Go', 'PostgreSQL', 'AWS'],
  },
  {
    id: 'applications',
    index: '04',
    title: 'Applications',
    short: 'Native feel, one codebase.',
    body: 'iOS, Android and cross-platform application development with offline-first data and 60fps interaction.',
    covers: ['Application development', 'iOS & Android', 'Cross-platform'],
    stack: ['React Native', 'Swift', 'Kotlin', 'Flutter'],
  },
  {
    id: 'brand-motion',
    index: '05',
    title: 'Brand & Motion',
    short: 'Identity in motion.',
    body: 'Graphic design and video editing — identities, campaign films and motion systems that hold formation across every surface.',
    covers: ['Graphic design', 'Video editing', 'Motion graphics'],
    stack: ['After Effects', 'Premiere', 'Illustrator', 'Blender'],
  },
  {
    id: 'growth-engineering',
    index: '06',
    title: 'Growth Engineering',
    short: 'Measured momentum.',
    body: 'Digital and performance marketing treated as an engineering problem: instrumented, tested, compounding.',
    covers: ['Digital marketing', 'Performance marketing', 'Analytics & CRO'],
    stack: ['GA4', 'Meta Ads', 'Google Ads', 'Looker'],
  },
]

export interface Stat {
  value: string
  label: string
  hint: string
}

/** Placeholder proof points — leading zeros are intentional (odometer reels). */
export const STATS: Stat[] = [
  { value: '140+', label: 'Products shipped', hint: 'since 2020' },
  { value: '03.2M+', label: 'End users reached', hint: 'across client platforms' },
  { value: '098%', label: 'Client retention', hint: 'year over year' },
  { value: '024', label: 'Awards & mentions', hint: 'design + engineering' },
]

export const AWARDS = [
  { label: 'Site of the Day', count: '×03', hue: '#3B82F6' },
  { label: 'Developer Award', count: '×05', hue: '#22D3EE' },
  { label: 'UI Excellence', count: '×04', hue: '#A78BFA' },
  { label: 'Innovation Prize', count: '×02', hue: '#D7FF3E' },
  { label: 'Mobile Excellence', count: '×02', hue: '#F472B6' },
  { label: 'Honorable Mention', count: '×08', hue: '#FB923C' },
]

export interface Project {
  slug: string
  client: string
  title: string
  year: number
  disciplines: string[]
  category: 'Platform' | 'Web' | 'App' | 'Brand' | 'Growth'
  /** Dominant colour — also verified at runtime by colour extraction. */
  color: string
  accent: string
  /** Generative cover recipe seed. */
  seed: number
  summary: string
  challenge: string
  approach: string
  results: { value: string; label: string }[]
  quote: { text: string; author: string; role: string }
}

export const PROJECTS: Project[] = [
  {
    slug: 'halden-wealth-os',
    client: 'Halden Capital',
    title: 'Wealth OS',
    year: 2025,
    disciplines: ['Platform', 'Product Design', 'Data'],
    category: 'Platform',
    color: '#1E3A8A',
    accent: '#60A5FA',
    seed: 11,
    summary: 'A real-time portfolio operating system for 40,000 private-banking clients.',
    challenge: 'Twelve legacy tools, four data vendors, one overloaded advisor team.',
    approach: 'We unified the data layer behind a streaming API and designed an advisor console that surfaces risk before it becomes a phone call.',
    results: [{ value: '−63%', label: 'Advisor prep time' }, { value: '4.9', label: 'App store rating' }, { value: '220ms', label: 'p95 dashboard load' }],
    quote: { text: 'They engineered calm into the most stressful part of our business.', author: 'Ira Menon', role: 'COO, Halden Capital' },
  },
  {
    slug: 'orbitra-fleet',
    client: 'Orbitra Mobility',
    title: 'Fleet Intelligence',
    year: 2025,
    disciplines: ['Software', 'Maps', 'Realtime'],
    category: 'Platform',
    color: '#0E7490',
    accent: '#22D3EE',
    seed: 23,
    summary: 'Live telemetry for 18,000 EVs rendered on a WebGL map that never drops a frame.',
    challenge: 'Millions of GPS pings per minute and a dispatcher UI that froze at rush hour.',
    approach: 'Vector tiles, GPU instancing and a websocket backbone with back-pressure. Dispatchers now see the whole city at 60fps.',
    results: [{ value: '18K', label: 'Vehicles live' }, { value: '60fps', label: 'At peak load' }, { value: '+31%', label: 'Fleet utilisation' }],
    quote: { text: 'The map went from our biggest complaint to the reason people join.', author: 'Daniel Okafor', role: 'CTO, Orbitra' },
  },
  {
    slug: 'kestrel-care',
    client: 'Kestrel Health',
    title: 'Care Platform',
    year: 2024,
    disciplines: ['App', 'Product Design', 'Accessibility'],
    category: 'App',
    color: '#065F46',
    accent: '#34D399',
    seed: 37,
    summary: 'A patient companion app designed for people who never asked for an app.',
    challenge: 'An audience aged 60+, chronic conditions, and zero tolerance for friction.',
    approach: 'Voice-first flows, WCAG AAA contrast and a care-team console that closes the loop in under a minute.',
    results: [{ value: '82%', label: '30-day retention' }, { value: 'AAA', label: 'WCAG conformance' }, { value: '−40%', label: 'Missed appointments' }],
    quote: { text: 'Our oldest patient onboarded herself. That was the whole brief.', author: 'Dr. Sana Iyer', role: 'Medical Director, Kestrel' },
  },
  {
    slug: 'lumen-atlas',
    client: 'Lumen Atlas',
    title: 'Spatial Commerce',
    year: 2024,
    disciplines: ['Web', 'WebGL', 'E-commerce'],
    category: 'Web',
    color: '#7C2D12',
    accent: '#FB923C',
    seed: 41,
    summary: 'A furniture store you walk through — in the browser, on a phone, in under two seconds.',
    challenge: 'Photoreal 3D and a mobile LCP budget of 2.5s are usually enemies.',
    approach: 'Progressive glTF streaming, baked lighting and a commerce layer that loads after the first frame.',
    results: [{ value: '+54%', label: 'Conversion' }, { value: '1.9s', label: 'Mobile LCP' }, { value: '3.1×', label: 'Time on site' }],
    quote: { text: 'Customers stopped asking for dimensions. They could see them.', author: 'Mara Lindqvist', role: 'Founder, Lumen Atlas' },
  },
  {
    slug: 'nova-grid',
    client: 'Nova Grid',
    title: 'Energy Command',
    year: 2024,
    disciplines: ['Data', 'Dashboard', 'Platform'],
    category: 'Platform',
    color: '#3F3F46',
    accent: '#D7FF3E',
    seed: 53,
    summary: 'A command centre for a regional solar grid, balancing 2GW in real time.',
    challenge: 'Operators needed seconds-old data and a UI that stays legible on a wall at 4am.',
    approach: 'A time-series pipeline with anomaly scoring and a dark, high-contrast interface tuned for control rooms.',
    results: [{ value: '2GW', label: 'Balanced live' }, { value: '<2s', label: 'Data freshness' }, { value: '−18%', label: 'Curtailment' }],
    quote: { text: 'It feels less like software and more like an instrument.', author: 'Arjun Rao', role: 'Head of Ops, Nova Grid' },
  },
  {
    slug: 'strata-system',
    client: 'Strata',
    title: 'Design System',
    year: 2023,
    disciplines: ['Design System', 'Brand', 'Docs'],
    category: 'Brand',
    color: '#4C1D95',
    accent: '#A78BFA',
    seed: 67,
    summary: '400 components, three platforms, one source of truth.',
    challenge: 'Five product teams shipping five different buttons.',
    approach: 'Tokens-first architecture compiled to web, iOS and Android, with live docs and visual regression in CI.',
    results: [{ value: '400+', label: 'Components' }, { value: '−70%', label: 'UI bugs' }, { value: '2×', label: 'Ship velocity' }],
    quote: { text: 'Our designers and engineers finally speak the same language.', author: 'Priya Shah', role: 'VP Design, Strata' },
  },
  {
    slug: 'pulse-run',
    client: 'Pulse',
    title: 'Run Club App',
    year: 2023,
    disciplines: ['App', 'Motion', 'Wearables'],
    category: 'App',
    color: '#9F1239',
    accent: '#FB7185',
    seed: 79,
    summary: 'A social running app with a live-pace engine synced to wearables.',
    challenge: 'Motion design that reads at a glance — mid-stride, in sunlight.',
    approach: 'Glanceable typography, haptic pacing and a Kotlin/Swift core shared through a cross-platform shell.',
    results: [{ value: '1.2M', label: 'Downloads' }, { value: '4.8', label: 'Rating' }, { value: '#3', label: 'Health & Fitness' }],
    quote: { text: 'The pace ring is the best piece of UI we own.', author: 'Leo Martins', role: 'CPO, Pulse' },
  },
  {
    slug: 'meridian-film',
    client: 'Meridian',
    title: 'Brand Film',
    year: 2023,
    disciplines: ['Video', 'Motion', 'Brand'],
    category: 'Brand',
    color: '#1F2937',
    accent: '#E5E7EB',
    seed: 83,
    summary: 'A 90-second launch film cut from 40 hours of footage and 12 motion systems.',
    challenge: 'Make infrastructure software feel cinematic without lying about it.',
    approach: 'Macro photography of real hardware, typographic motion and a sound design built from server-room recordings.',
    results: [{ value: '2.4M', label: 'Views' }, { value: '9.1%', label: 'CTR from film' }, { value: '06', label: 'Festival selections' }],
    quote: { text: 'We finally have a story as precise as our product.', author: 'Hannah Cole', role: 'CMO, Meridian' },
  },
  {
    slug: 'cobalt-pay',
    client: 'Cobalt',
    title: 'Pay',
    year: 2022,
    disciplines: ['Fintech', 'App', 'Security'],
    category: 'App',
    color: '#1D4ED8',
    accent: '#93C5FD',
    seed: 97,
    summary: 'UPI-native payments with a fraud model that runs on-device.',
    challenge: 'Sub-second payments, bank-grade security, and first-time smartphone users.',
    approach: 'On-device ML scoring, biometric flows and a progressive interface that teaches itself.',
    results: [{ value: '₹1,200Cr', label: 'Monthly volume' }, { value: '0.02%', label: 'Fraud rate' }, { value: '640ms', label: 'Median payment' }],
    quote: { text: 'Fast enough that users think it is broken. Then they trust it.', author: 'Vikram Desai', role: 'Founder, Cobalt' },
  },
  {
    slug: 'arcline-launch',
    client: 'Arcline',
    title: 'Launch Campaign',
    year: 2022,
    disciplines: ['Performance', 'Growth', 'Creative'],
    category: 'Growth',
    color: '#365314',
    accent: '#A3E635',
    seed: 101,
    summary: 'A full-funnel launch: creative, media and a landing system tested 140 ways.',
    challenge: 'A crowded category and a cost per acquisition that had to halve.',
    approach: 'Modular creative, server-side tracking and an experimentation cadence of two tests a day.',
    results: [{ value: '−52%', label: 'CPA' }, { value: '5.8×', label: 'ROAS' }, { value: '140', label: 'Experiments run' }],
    quote: { text: 'Growth stopped being a guess. It became a system.', author: 'Nadia Hassan', role: 'Growth Lead, Arcline' },
  },
]

export interface Testimonial {
  client: string
  quote: string
  author: string
  role: string
  transcript: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    client: 'Halden Capital',
    quote: 'GBGTech do not hand over designs and hope. They hand over systems — measured, documented and faster than we asked for.',
    author: 'Ira Menon',
    role: 'Chief Operating Officer',
    transcript: 'We had twelve tools and a team that was drowning. Within six months GBGTech gave us one platform, and our advisors got their evenings back. What surprised me was the rigour: every decision came with a number behind it.',
  },
  {
    client: 'Orbitra',
    quote: 'The most senior engineering partner we have worked with. They found the bottleneck in week one that our team had chased for a year.',
    author: 'Daniel Okafor',
    role: 'Chief Technology Officer',
    transcript: 'Week one they profiled our dispatcher app and showed us exactly why it froze at rush hour. By week six it held sixty frames per second with the whole city on screen.',
  },
  {
    client: 'Kestrel Health',
    quote: 'They designed for the patient who will never read a manual — and they made accessibility the most beautiful part of the product.',
    author: 'Dr. Sana Iyer',
    role: 'Medical Director',
    transcript: 'Our audience is older and often unwell. GBGTech sat with patients, rebuilt the flows around voice, and the result is the first health app our patients actually like.',
  },
  {
    client: 'Arcline',
    quote: 'Creative and analytics in one room. Our acquisition cost halved and our brand got sharper at the same time.',
    author: 'Nadia Hassan',
    role: 'Head of Growth',
    transcript: 'Most agencies pick a side: brand or performance. GBGTech refused to. Two experiments a day, every day, and the creative kept getting better.',
  },
]

export const PROCESS = [
  { index: '01', title: 'Calibrate', body: 'Two-week discovery sprint: audits, interviews, metrics baselines and a technical spike that proves the risky parts first.' },
  { index: '02', title: 'Engineer', body: 'Design and engineering in one squad, shipping weekly behind feature flags, with performance budgets enforced in CI.' },
  { index: '03', title: 'Compound', body: 'Launch is a starting line. We instrument, experiment and iterate until the numbers move — and keep moving.' },
]

export const TECH_STACK = [
  { index: '01', group: 'Frontend', items: ['Next.js', 'React', 'TypeScript', 'Three.js', 'GSAP', 'WebGL / GLSL'] },
  { index: '02', group: 'Backend', items: ['Node.js', 'Go', 'Python', 'GraphQL', 'PostgreSQL', 'Redis'] },
  { index: '03', group: 'Mobile', items: ['React Native', 'Swift', 'Kotlin', 'Flutter', 'Expo'] },
  { index: '04', group: 'Cloud & DevOps', items: ['AWS', 'GCP', 'Vercel', 'Docker', 'Kubernetes', 'Terraform'] },
  { index: '05', group: 'Design & Motion', items: ['Figma', 'Blender', 'After Effects', 'Rive', 'Premiere Pro'] },
  { index: '06', group: 'Growth', items: ['GA4', 'Meta Ads', 'Google Ads', 'Mixpanel', 'Looker Studio'] },
]

export const TEAM = [
  { name: 'Founder & CEO', role: 'Strategy', initials: 'GB', hue: 220 },
  { name: 'Head of Engineering', role: 'Platforms', initials: 'HE', hue: 190 },
  { name: 'Design Director', role: 'Experience', initials: 'DD', hue: 260 },
  { name: 'Creative Lead', role: 'Brand & Motion', initials: 'CL', hue: 330 },
  { name: 'Growth Lead', role: 'Performance', initials: 'GL', hue: 75 },
  { name: 'Mobile Lead', role: 'Applications', initials: 'ML', hue: 150 },
]

export const CULTURE = [
  { label: 'Hack week 2025', seed: 3 },
  { label: 'Studio, Bhopal', seed: 7 },
  { label: 'Design crit', seed: 13 },
  { label: 'Ship day', seed: 19 },
  { label: 'Offsite — Pachmarhi', seed: 29 },
  { label: 'Whiteboard', seed: 31 },
  { label: 'Prototype lab', seed: 43 },
  { label: 'Friday demos', seed: 47 },
  { label: 'Camera test', seed: 59 },
  { label: 'Late build', seed: 61 },
]

export const getProject = (slug: string) => PROJECTS.find((p) => p.slug === slug)
export const nextProject = (slug: string) => {
  const i = PROJECTS.findIndex((p) => p.slug === slug)
  return PROJECTS[(i + 1) % PROJECTS.length]!
}
