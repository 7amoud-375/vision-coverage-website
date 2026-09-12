import { about, site } from '../../lib/config'
import Watermark from '../brand/Watermark'

export default function About() {
  return (
    <section id="about" className="relative overflow-hidden border-t border-line bg-surface/30">
      <Watermark position="top-right" size="xl" rotate={12} from="lg" />
      <div className="section grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:gap-16">
        {/* --- portrait --- */}
        <div className="mx-auto w-full max-w-sm md:mx-0">
          <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-2">
            {about.photo ? (
              <img
                src={about.photo}
                alt={site.ownerName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-faint">
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M3 8.5A2.5 2.5 0 015.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-8z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
                <span className="text-xs uppercase tracking-widest">Portrait</span>
              </div>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-3">
            {about.stats.map((stat) => (
              <div key={stat.label} className="card px-3 py-4 text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-2xl font-semibold text-accent">{stat.value}</dd>
                <dd className="mt-1 text-[0.7rem] uppercase tracking-wider text-muted">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* --- bio --- */}
        <div>
          <p className="section-kicker">About</p>
          <h2 className="section-title">Behind the camera</h2>

          <div className="mt-6 space-y-4">
            {about.bio.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>

          <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {about.highlights.map((item) => (
              <div key={item.label} className="bg-surface px-5 py-4">
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  {item.label}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
