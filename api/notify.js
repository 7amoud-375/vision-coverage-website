// ---------------------------------------------------------------------------
//  OPTIONAL Vercel Serverless Function - new booking notification.
//
//  Everything the site needs works without this file: the booking itself is
//  written straight to Supabase from the browser. This only pings a webhook
//  (Slack, Make, Zapier, a WhatsApp gateway...) so the owner hears about a
//  request without opening the dashboard.
//
//  It exists as a function rather than client code for one reason: the client
//  must never be trusted to say what a booking contains. The browser sends only
//  a date; this handler looks the reservation up server-side with the service
//  role key and forwards what the database actually holds.
//
//  To enable, set these in the Vercel dashboard (NOT prefixed with VITE_, they
//  are server-only and must never reach the browser):
//     SUPABASE_URL
//     SUPABASE_SERVICE_ROLE_KEY
//     NOTIFY_WEBHOOK_URL
//  With any of them missing the handler quietly does nothing, so local dev and
//  preview deploys are unaffected.
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL

  // Not configured is a valid state, not an error - the booking already saved.
  if (!supabaseUrl || !serviceKey || !webhookUrl) {
    return res.status(200).json({ notified: false, reason: 'not configured' })
  }

  const date = typeof req.body?.date === 'string' ? req.body.date : null
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'A valid date is required.' })
  }

  try {
    // Read the reservation back from the database rather than trusting the
    // request body, so a forged POST cannot inject arbitrary text.
    // Only look at requests created in the last few minutes. The endpoint is
    // necessarily open - the browser calls it straight after booking, so there
    // is no secret it could hold that a visitor could not read - but this
    // narrows it to a genuine "just happened" window. Replaying old dates, or
    // sweeping the calendar to make the owner's phone buzz, gets nothing back.
    const freshSince = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const query =
      `${supabaseUrl}/rest/v1/bookings` +
      `?date=eq.${encodeURIComponent(date)}&status=eq.pending` +
      `&created_at=gte.${encodeURIComponent(freshSince)}` +
      `&select=date,client_name,phone,event_type,location,notes` +
      `&order=created_at.desc&limit=1`

    const lookup = await fetch(query, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (!lookup.ok) throw new Error(`Supabase responded ${lookup.status}`)

    const [booking] = await lookup.json()
    if (!booking) {
      return res.status(200).json({ notified: false, reason: 'no recent pending booking' })
    }

    const lines = [
      'New booking request',
      `Date: ${booking.date}`,
      `Name: ${booking.client_name}`,
      `Phone: ${booking.phone}`,
      `Type: ${booking.event_type}`,
      `Location: ${booking.location}`,
      booking.notes ? `Notes: ${booking.notes}` : null,
    ].filter(Boolean)

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n'), booking }),
    })

    return res.status(200).json({ notified: true })
  } catch (error) {
    // Never surface this to the visitor: their booking succeeded either way.
    console.error('[notify] failed', error)
    return res.status(200).json({ notified: false, reason: 'delivery failed' })
  }
}
