import { supabase } from './supabaseClient'

const BUCKET = 'portfolio'

/** Matches the bucket's own file_size_limit, so we fail early and politely. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/** Long clips burn the egress budget; a portfolio piece is a highlight, not a film. */
export const MAX_VIDEO_SECONDS = 150

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

const prettyMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

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

/** Read a video's duration without uploading it. Returns null if unreadable. */
async function readDuration(file) {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  try {
    video.preload = 'metadata'
    video.src = objectUrl
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
      setTimeout(reject, 10000)
    })
    return Number.isFinite(video.duration) ? video.duration : null
  } catch {
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
    if (result.code === 413) return { error: 'That file is larger than the storage limit allows.' }
    if (result.code === 403)
      return { error: 'Upload refused - this account may not have owner access yet.' }
    return { error: 'Upload failed. Check your connection and try again.' }
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
        `That video is ${prettyMB(file.size)}, over the ${prettyMB(MAX_VIDEO_BYTES)} limit. ` +
        'Please trim it or export at a lower resolution.',
    }
  }

  const duration = await readDuration(file)
  if (duration && duration > MAX_VIDEO_SECONDS) {
    return {
      error:
        `That clip runs ${Math.round(duration)} seconds. Please keep highlights under ` +
        `${MAX_VIDEO_SECONDS} seconds - long videos use up the monthly bandwidth budget fast.`,
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
    file.type || 'video/mp4',
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
