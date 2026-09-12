import { site, heroMedia } from '../../lib/config'
import Button from '../ui/Button'
import Mark from '../brand/Mark'

/**
 * Full-bleed hero. Uses a video if one is configured, then an image, then a
 * gradient placeholder - so it looks intentional before any real media exists.
 */
export default function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden">
      {/* --- background layer --- */}
      <div className="absolute inset-0 -z-10">
        {heroMedia.video ? (
          <video
            className="h-full w-full object-cover"
            src={heroMedia.video}
            poster={heroMedia.poster || undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : heroMedia.image ? (
          <img
            src={heroMedia.image}
            alt=""
            className="h-full w-full object-cover"
            // Lowercase on purpose: React only added camelCase `fetchPriority`
            // in v19. On 18 it is an unrecognised prop that warns at runtime and
            // lands in the DOM mangled; the lowercase attribute passes straight
            // through. The lint rule assumes React 19, so it is wrong here -
            // revisit when this project moves to 19.
            // eslint-disable-next-line react/no-unknown-property
            fetchpriority="high"
          />
        ) : (
          // Placeholder: swap in a still or showreel via src/lib/config.js
          <div
            className="h-full w-full"
            style={{
              background:
                'radial-gradient(120% 80% at 15% 15%, #2b2620 0%, transparent 55%),' +
                'radial-gradient(100% 90% at 85% 25%, #1c2430 0%, transparent 60%),' +
                'linear-gradient(160deg, #101014 0%, #0b0b0d 55%, #16130e 100%)',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-base/30" />

        {/*
          The chevron as a watermark. Large, barely-there, and bleeding off the
          right edge so it reads as a graphic device rather than a floating
          logo. Hidden on small screens, where it would only crowd the headline.
        */}
        <Mark
          className="absolute -right-16 top-1/2 hidden h-[42rem] w-[42rem] -translate-y-1/2
                     text-ink/[0.04] lg:block"
          strokeWidth={3}
        />
      </div>

      <div className="mx-auto w-full max-w-content px-5 pb-20 pt-28 sm:px-8">
        <div className="max-w-2xl animate-fade-up">
          <p className="section-kicker">Photography &amp; Videography</p>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl md:text-7xl">
            {site.tagline}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {site.intro}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button as="a" href="#reservation" size="lg">
              Check availability
            </Button>
            <Button as="a" href="#portfolio" variant="outline" size="lg">
              See the work
            </Button>
          </div>
        </div>
      </div>

      <a
        href="#portfolio"
        aria-label="Scroll to portfolio"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-muted transition-colors hover:text-accent sm:block"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 animate-bounce" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </section>
  )
}
