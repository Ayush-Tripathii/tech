import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'
const repoName = process.env.GITHUB_REPOSITORY?.replace(/.*?\//, '') ?? 'tech'
const isUserRepo = repoName.endsWith('.github.io')

// Use repoName when building in GitHub Actions or in production unless overridden
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (process.env.GITHUB_ACTIONS
    ? (isUserRepo ? '' : `/${repoName}`)
    : (isProd ? '/tech' : ''))

/**
 * Static export: every route is pre-rendered to /out so the site can be served
 * from GitHub Pages (or any static host) with zero server cost.
 */
const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Tree-shake GSAP / three barrel imports aggressively.
    optimizePackageImports: ['gsap', 'three'],
  },
}

export default nextConfig
