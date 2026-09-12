import { site, contact, whatsappLink } from '../../lib/config'
import Wordmark from '../brand/Wordmark'
import Watermark from '../brand/Watermark'

function SocialLink({ href, label, children }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line
                 text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </a>
  )
}

export default function Footer() {
  const whatsapp = whatsappLink()
  // Anything unset is simply absent - see the note in src/lib/config.js about
  // why there are no placeholder fallbacks here.
  const hasContact = contact.phone || contact.email || whatsapp
  const hasSocial = contact.instagram || contact.facebook

  return (
    <footer id="contact" className="relative overflow-hidden border-t border-line bg-surface/40">
      <Watermark position="bottom-right" size="xl" opacity="text-ink/[0.025]" from="sm" />
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{site.tagline}.</p>
          </div>

          {hasContact && (
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Get in touch
              </h3>
              <ul className="space-y-2.5 text-sm text-muted">
                {contact.phone && (
                  <li>
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, '')}`}
                      className="transition-colors hover:text-ink"
                    >
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="transition-colors hover:text-ink">
                      {contact.email}
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent transition-colors hover:text-accent-soft"
                    >
                      Message on WhatsApp
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasSocial && (
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Follow
              </h3>
              <div className="flex gap-3">
                <SocialLink href={contact.instagram} label="Instagram">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                </SocialLink>
                <SocialLink href={contact.facebook} label="Facebook">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.12-2.41-.12-2.38 0-4.01 1.45-4.01 4.12v2.3H7.5V13h2.78v8h3.22z" />
                  </svg>
                </SocialLink>
              </div>
            </div>
          )}
        </div>

        <div className="relative mt-14 space-y-1.5 border-t border-line pt-6 text-center text-xs text-muted">
          <p>
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            Coded and designed by{' '}
            <a
              href="https://my-portfolio-chi-two-55.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline decoration-line underline-offset-4
                         transition-colors hover:text-accent hover:decoration-accent"
            >
              Ibrahim Hamoud
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
