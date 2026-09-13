import { site, contact, whatsappLink } from '../../lib/config'
import Wordmark from '../brand/Wordmark'
import SocialIcon from '../brand/SocialIcon'
import { platformLabel } from '../../lib/socialPlatforms'
import { useSocialLinks } from '../../hooks/useSocialLinks'
import Watermark from '../brand/Watermark'

function SocialLink({ href, label, platform }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line
                 text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <SocialIcon platform={platform} />
    </a>
  )
}

export default function Footer() {
  const whatsapp = whatsappLink()
  const { socials } = useSocialLinks()

  // The database is the source of truth once the migration has been run. Until
  // then - or if the owner has not added any - fall back to whatever is set in
  // .env, so the footer never loses its links mid-migration.
  const links = socials.length
    ? socials
    : [
        contact.instagram && { platform: 'instagram', url: contact.instagram },
        contact.facebook && { platform: 'facebook', url: contact.facebook },
      ].filter(Boolean)
  // Anything unset is simply absent - see the note in src/lib/config.js about
  // why there are no placeholder fallbacks here.
  const hasContact = contact.phone || contact.email || whatsapp
  const hasSocial = links.length > 0

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
                Follow us
              </h3>
              <div className="flex flex-wrap gap-3">
                {links.map((link) => (
                  <SocialLink
                    key={link.platform + link.url}
                    href={link.url}
                    platform={link.platform}
                    label={platformLabel(link.platform)}
                  />
                ))}
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
