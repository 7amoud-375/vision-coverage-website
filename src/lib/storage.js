import { supabase } from './supabaseClient'

const BUCKET = 'portfolio'

/** Matches the bucket's own file_size_limit, so we fail early and politely. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

// There is deliberately no duration limit. Length was a bad proxy for the thing
// that actually matters: a tightly encoded five-minute clip can sit under the
// size cap while a badly exported thirty-second one blows straight past it. The
// file size below is the real constraint, so that is what gets checked.

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

const prettyMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Pick a content type the bucket will actually accept.
 *
 * Browsers and phones are inconsistent about File.type - it can be blank, or
 * something outside the bucket's MIME allow-list, which storage then rejects
 * with an opaque 400. Deriving it from the extension and falling back to mp4
 * keeps that from happening.
 */
function contentTypeFor(file, extension) {
  if (VIDEO_TYPES.includes(file.type)) return file.type

  switch (extension) {
    case 'mov':
      return 'video/quicktime'
    case 'webm':
      return 'video/webm'
    default:
      return 'video/mp4'
  }
}

// ---------------------------------------------------------------------------
//  Poster frames
// ---------------------------------------------------------------------------

/**
 * Grab a still from the picked video, in the browser, to use as the gallery
 * poster. This is what keeps the grid cheap: cards show these ~150 KB images
 * and the video file is fetched only when someone presses play.
 *
 * Resolves to null rather than throwing when the browser cannot decode the
 * format - a missing poster is cosmetic, not a reason to block the upload.
 */
export async function captureVideoPoster(file, { maxEdge = 1400 } = {}) {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')

  try {
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('metadata failed'))
      video.onloadedmetadata = resolve
      video.onerror = fail
      setTimeout(fail, 10000)
    })

    // A frame slightly in is more representative than frame zero, which is
    // often black while the camera settles.
    const target = Math.min(1.5, (video.duration || 2) * 0.25)
    await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('seek failed'))
      video.onseeked = resolve
      video.onerror = fail
      setTimeout(fail, 10000)
      video.currentTime = target
    })

    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    if (!canvas.width || !canvas.height) return null

    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

    let last = null
    for (const quality of [0.82, 0.7, 0.6]) {
      last = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
      if (last && last.size <= 350 * 1024) return last
    }
    return last
  } catch (err) {
    console.warn('[storage] could not capture a poster frame', err.message)
    return null
  } finally {
    video.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

// ---------------------------------------------------------------------------
//  Upload
// ---------------------------------------------------------------------------

/**
 * Upload one blob and return its public URL.
 *
 * Uses XMLHttpRequest rather than supabase-js because the JS client exposes no
 * progress events, and a 40 MB upload over mobile data with no progress bar is
 * indistinguishable from a hung app.
 */
async function putObject(path, blob, contentType, onProgress) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) return { error: 'Your session expired. Please sign in again.' }

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`

  const result = await new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
    xhr.setRequestHeader('Content-Type', contentType)
    // Filenames are UUIDs and never rewritten, so these objects are immutable -
    // a one-year cache is safe and cuts repeat egress, which is the scarcest
    // resource on the free tier. (Verified that Supabase's storage endpoint
    // permits this header in a CORS preflight.)
    xhr.setRequestHeader('cache-control', 'max-age=31536000')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () =>
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.responseText, code: xhr.status })
    xhr.onerror = () => resolve({ ok: false, body: 'network error', code: 0 })
    xhr.onabort = () => resolve({ ok: false, body: 'aborted', code: 0 })
    xhr.send(blob)
  })

  if (!result.ok) {
    console.error('[storage] upload failed', result.code, result.body)

    // Surface what the server actually said. This is an owner-only screen, and
    // a generic "check your connection" turned a fixable configuration problem
    // into a guessing game - the detail belongs in front of whoever can act on it.
    let detail = ''
    try {
      detail = JSON.parse(result.body)?.message || ''
    } catch {
      detail = typeof result.body === 'string' ? result.body.slice(0, 160) : ''
    }

    if (result.code === 413) {
      return { error: `That file is larger than the ${prettyMB(MAX_VIDEO_BYTES)} storage limit.` }
    }
    if (result.code === 403 || /not authorized|permission/i.test(detail)) {
      return {
        error:
          'Storage refused the upload. This account may not have owner access yet - ' +
          'check there is a row for it in the admins table.',
      }
    }
    if (result.code === 400 && /mime|content type/i.test(detail)) {
      return {
        error: `Storage rejected that file type${detail ? ` (${detail})` : ''}. Try an MP4.`,
      }
    }
    if (result.code === 404 || /bucket not found/i.test(detail)) {
      return {
        error:
          'The storage bucket does not exist. Run supabase/migration-video-upload.sql in the ' +
          'SQL editor first.',
      }
    }
    if (result.code === 0) {
      return {
        error:
          'The upload could not reach Supabase - the request was blocked or the connection ' +
          'dropped. Check the browser console for details.',
      }
    }

    return { error: `Upload failed (HTTP ${result.code})${detail ? `: ${detail}` : ''}.` }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * Validate, capture a poster from, and upload one video.
 * Returns { videoUrl, posterUrl, error } and never throws.
 */
export async function uploadVideo(file, { onProgress, onStage } = {}) {
  if (!file) return { error: 'No file selected.' }

  const looksLikeVideo =
    VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|m4v|webm)$/i.test(file.name)
  if (!looksLikeVideo) {
    return { error: 'Please choose an MP4, MOV or WebM video.' }
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return {
      error:
        `That video is ${prettyMB(file.size)}, and the storage limit is ` +
        `${prettyMB(MAX_VIDEO_BYTES)} per file. Export it at 720p or a lower bitrate and it ` +
        'will usually fit - length is not the problem, file size is.',
    }
  }

  // Poster first: it is quick, and there is no sense uploading 40 MB of video
  // if the file turns out to be undecodable anyway.
  onStage?.('Preparing')
  const poster = await captureVideoPoster(file)

  const id = crypto.randomUUID()
  let posterUrl = null

  if (poster) {
    onStage?.('Uploading cover')
    const posterResult = await putObject(`${id}-poster.jpg`, poster, 'image/jpeg')
    if (posterResult.error) return { error: posterResult.error }
    posterUrl = posterResult.url
  }

  onStage?.('Uploading video')
  const extension = /\.(\w+)$/.exec(file.name)?.[1]?.toLowerCase() || 'mp4'
  const videoResult = await putObject(
    `${id}.${extension}`,
    file,
    contentTypeFor(file, extension),
    onProgress
  )

  if (videoResult.error) {
    // Do not leave an orphan poster behind for a video that never landed.
    if (posterUrl) deleteStoredFile(posterUrl)
    return { error: videoResult.error }
  }

  return { videoUrl: videoResult.url, posterUrl, error: null }
}

/**
 * Remove a file we previously uploaded. Best-effort: a missing object is not
 * worth blocking an edit over, and only paths inside our own bucket are touched.
 */
export async function deleteStoredFile(url) {
  const path = storagePathFromUrl(url)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[storage] could not remove', path, error.message)
}

/** Public URL -> object path, or null if the URL is not one of ours. */
export function storagePathFromUrl(url) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}
