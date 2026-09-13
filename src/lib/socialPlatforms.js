// The platforms offered in the dashboard, and the order they are listed in.
// Kept out of SocialIcon.jsx so that file exports only a component - a module
// mixing components and constants breaks Fast Refresh during development.
export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/201234567890' },
  { id: 'x', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { id: 'behance', label: 'Behance', placeholder: 'https://behance.net/you' },
  { id: 'vimeo', label: 'Vimeo', placeholder: 'https://vimeo.com/you' },
  { id: 'website', label: 'Website', placeholder: 'https://example.com' },
]

export const platformLabel = (id) =>
  PLATFORMS.find((p) => p.id === id)?.label ?? 'Link'
