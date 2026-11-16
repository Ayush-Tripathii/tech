# GBGTech — gbgtech.com

Dark, cinematic, WebGL-driven studio site. Next.js 15 (App Router, static export), raw Three.js, GSAP 3.15, Lenis, Web Audio.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → ./out
npm run typecheck
```

Append `?fps` to any URL for the FPS / quality-tier overlay.

## Architecture: one shared state, many consumers

| Layer | File | Role |
|---|---|---|
| Engine | `src/lib/motion/engine.ts` | The **only** ticker (`gsap.ticker`) driving Lenis, plus the only pointer listener. Subsystems `subscribe()` and read `frame`. |
| Frame state | `src/lib/motion/frame.ts` | Per-frame scroll / velocity / pointer / energy channels (mutable, never triggers React renders). Combine with `Math.max`. |
| Discrete state | `src/lib/motion/store.ts` | Zustand: `transitionComplete` gate, menu, cursor hold, sound. |
| Tokens | `src/lib/motion/tokens.ts` + `globals.css` | Eases (registered as CustomEase with the exact beziers), durations, staggers. |
| Loader | `src/lib/motion/loader.ts` | Honest asset progress for preloader reel 3. |
| Audio | `src/lib/audio/AudioManager.ts` | Lazy AudioContext on first gesture, all synthesis at runtime, 60 ms debounce, voice stealing, 0.4 ceiling. |
| WebGL budget | `src/lib/webgl/capabilities.ts` | Context probe, ≤2-context budget, DPR caps, 60-frame FPS monitor → auto-degrade tiers (DPR → cheap material → static). |

Every scene mounts its own canvas only while within one viewport of the screen. It renders only while visible, and disposes geometry, materials, textures and the context when it leaves.

## Map of the spec

- **Preloader** (`components/system/Preloader.tsx`): six beats, sessionStorage-gated, 5 s ceiling, 400 ms fade for return visits.
- **Lattice Core** (`components/webgl/LatticeCore.ts`): 60 panels (pentakis dodecahedron), 24 on mobile (tetrakis). CubeCamera env, transmission glass, three orbiting arcs, idle / charged / refracted states, magnetic hover (raycast gated at assembled > 0.98), quaternion drag inertia (0.94), hold-to-refract (900 ms wall-clock; Space/Enter on keyboard), spectrum beam, distance-staggered snap re-assembly.
- **Guide lines + weld sparks** (`components/home/GuideLines.tsx`).
- **Services sequence** (`components/home/ServicesSequence.tsx`): one progress value drives every effect. Frame player is raw WebGL2 with a hue-preserving `uInvert` uniform.
- **Double helix** (`components/webgl/Helix.ts`): vertex-shader bending, SDF corners, fresnel rim, analytic ray–cylinder picking, spring hover, on-demand rendering, dwell plateaus per card, click-to-fly into the page transition.
- **Footer**: plucked-wire wordmark (Karplus–Strong pentatonic notes) → `lib/motion/atmosphere.ts` → domain-warped fog shader.
- **Interior pages**: `/work` (FLIP filters, cursor-follow preview), `/work/[slug]` (pinned hero, sticky rail, 0.85/1/1.15 parallax, peel-up next project), `/services` (12k-particle curl swarm, accordion, scroll-drawn process line), `/about` (depth-map shader, spring curtains gated on the headline reveal, Draggable team, rejection-sampled scatter wall with dominant-colour tint), `404` (the Lattice Core as a "404" glyph).

## Placeholder content and asset slots

All proof points, clients, projects and testimonials in `src/lib/content/site.ts` are **fictional placeholders**. Replace them before launch, including the award labels, phone number and social URLs. Imagery is generative (`lib/content/generative.ts`), so the site ships with no stock photos.

Drop-in real assets (each is opt-in so the site never requests missing files):

| Asset | Path | Enable |
|---|---|---|
| Services frame sequence (240 WebP @1600, 120 mobile) | `public/frames/services/` + `manifest.json` (format documented in `FrameSequence.ts`) | `NEXT_PUBLIC_SERVICES_FRAMES=1` |
| About portrait + depth map | `public/about/portrait.jpg`, `public/about/depth.png` | `NEXT_PUBLIC_ABOUT_PORTRAIT=1` |
| Ambient bed / whoosh loops | `public/audio/bed.mp3`, `public/audio/whoosh.mp3` | automatic, with procedural fallback |
| Contact form endpoint | any JSON POST endpoint (e.g. Formspree) | `NEXT_PUBLIC_FORM_ENDPOINT=https://…` |

Without a form endpoint, submissions are simulated. The success state shows, but nothing is sent.

## Deploy

### GitHub Pages (Automated via GitHub Actions)
1. Push to `main` branch.
2. In the GitHub repository, go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The workflow will automatically build and publish the site to `https://Ayush-Tripathii.github.io/tech/`.

### Vercel
Import the repo. `vercel.json` sets immutable caching for `/_next/static`. Output is fully static (`out/`).
