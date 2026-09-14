import { supabase, isMissingTable } from './supabaseClient'

const BUCKET = 'portfolio'

/** Matches the bucket's own file_size_limit, so we fail early and politely. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

// There is deliberately no duration limit. Length was a bad proxy for the thing
// that actually matters: a tightly encoded five-minute clip can sit under the
// size cap while a badly exported thirty-second one blows straight past it. The
// file size below is the real constraint, so that is what gets checked.

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm'

// Total bucket budget. Postgres has no per-bucket quota, so this is enforced
// here rather than in SQL. Deliberately under the free plan's 1 GB so hitting
// it produces a clear message from us rather than an opaque failure from
// Supabase - and leaves room for the poster images alongside the videos.
export const STORAGE_BUDGET_BYTES = 800 * 1024 * 1024

/** Where the dashboard starts warning rather than just reporting. */
export const STORAGE_WARN_RATIO = 0.8

export const prettySize = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

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
          'The storage bucket does not exist. Run supabase/migration-video-storage.sql in the ' +
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

  // Check the budget against what is actually stored rather than a cached
  // number: two tabs, or a delete that has not reached this screen yet, would
  // both make a stale figure wrong in the direction that matters.
  onStage?.('Checking space')
  const usage = await getStorageUsage()
  if (!usage.error) {
    // The poster is uploaded alongside the video; allow for it so the budget is
    // not quietly overshot by the thing we add ourselves.
    const needed = file.size + 200 * 1024
    if (usage.bytes + needed > STORAGE_BUDGET_BYTES) {
      const overBy = usage.bytes + needed - STORAGE_BUDGET_BYTES
      return {
        error:
          `Not enough space. ${prettySize(usage.bytes)} of ${prettySize(STORAGE_BUDGET_BYTES)} ` +
          `is already used, and this video needs ${prettySize(file.size)}. Delete about ` +
          `${prettySize(overBy)} of older work first, or export this one smaller.`,
      }
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
    // Awaited so the poster is gone before the caller refreshes the storage
    // meter, which would otherwise still count it.
    if (posterUrl) await deleteStoredFile(posterUrl)
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
  if (!path) return { error: null }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.warn('[storage] could not remove', path, error.message)
    return { error: error.message }
  }
  return { error: null }
}

/** Public URL -> object path, or null if the URL is not one of ours. */
export function storagePathFromUrl(url) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

// ---------------------------------------------------------------------------
//  Images
// ---------------------------------------------------------------------------

// The picker offers everything a phone or camera is likely to hand over.
// `image/*` covers the formats browsers decode natively; the explicit
// extensions matter because Windows frequently reports an EMPTY file.type for
// .heic, so a type-only filter hides the very files an iPhone produces.
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.HEIC,.HEIF,.tif,.tiff,.avif,.webp'

/** Generous, because the file is resized in the browser before it is sent. */
const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024

// Camera RAW is deliberately not supported. Every format below needs a
// manufacturer-specific decoder measured in megabytes, and a RAW file is a
// sensor dump that still needs developing - the right answer is to export a
// JPEG from Lightroom, not to guess at a rendering in the browser.
const RAW_EXTENSIONS = /\.(cr2|cr3|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|pef|x3f|3fr|erf)$/i

/**
 * Identify a file by its first bytes rather than by name or MIME type.
 *
 * Both of those lie routinely: Windows reports "" for .heic, some phones hand
 * over a .jpg name for an HEIC payload, and a renamed file carries whatever
 * extension it was given. The magic bytes are the only honest answer, and
 * picking the wrong decoder is the difference between a portrait and an error.
 */
async function sniffImageFormat(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (head.length < 12) return null

  const ascii = (start, length) => String.fromCharCode(...head.subarray(start, start + length))

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
  if (head[0] === 0x89 && ascii(1, 3) === 'PNG') return 'png'
  if (ascii(0, 3) === 'GIF') return 'gif'
  if (ascii(0, 2) === 'BM') return 'bmp'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp'

  // HEIC and AVIF are both ISO base media containers; only the brand at byte 8
  // tells them apart, and only one of the two decodes natively.
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4)
    if (/^(heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand)) return 'heic'
    if (/^(avif|avis)$/.test(brand)) return 'avif'
    return null
  }

  // TIFF, little- and big-endian. Most RAW files are TIFF containers too, which
  // is why the extension check runs before this one.
  if (ascii(0, 2) === 'II' && head[2] === 0x2a) return 'tiff'
  if (ascii(0, 2) === 'MM' && head[3] === 0x2a) return 'tiff'

  return null
}

/**
 * Decode a blob the browser already understands, into something drawable.
 *
 * createImageBitmap is tried first: it decodes off the main thread and needs no
 * object URL at all. The <img> path stays as a fallback for anything that
 * refuses it - and note that path needs `blob:` in the CSP's img-src, which is
 * exactly what broke portrait uploads on the deployed site once already.
 */
async function decodeNatively(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // Fall through - some browsers reject formats here that <img> accepts.
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      img.src = objectUrl
    })
  } finally {
    // Safe to revoke here: the pixels are decoded by the time onload fires, and
    // drawImage no longer needs the URL to resolve.
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Turn any supported file into something canvas can draw.
 *
 * The two converters are imported dynamically, and only when a file actually
 * needs one. Between them they are several megabytes - loading that on every
 * visit, for a conversion the owner performs a handful of times, would be
 * indefensible on a site where bandwidth is the binding constraint. This way
 * the cost lands on whoever uploads an iPhone photo, once, in the dashboard.
 */
async function decodeImage(file, format) {
  if (format === 'heic') {
    // The /csp build is the one meant for a strict Content-Security-Policy.
    // It still spawns its worker from a blob: URL, so worker-src must allow
    // blob: - see vercel.json.
    const { heicTo } = await import('heic-to/csp')
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
    return decodeNatively(jpeg)
  }

  if (format === 'tiff') {
    const UTIF = (await import('utif2')).default
    const buffer = await file.arrayBuffer()
    const pages = UTIF.decode(buffer)
    if (!pages.length) throw new Error('no image in tiff')

    const page = pages[0]
    UTIF.decodeImage(buffer, page, pages)
    const rgba = UTIF.toRGBA8(page)

    const canvas = document.createElement('canvas')
    canvas.width = page.width
    canvas.height = page.height
    canvas
      .getContext('2d')
      .putImageData(new ImageData(new Uint8ClampedArray(rgba), page.width, page.height), 0, 0)
    return canvas
  }

  return decodeNatively(file)
}

/** ImageBitmap, <img> and <canvas> each spell their dimensions differently. */
function sizeOf(source) {
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  }
}

/**
 * Resize and re-encode an image in the browser, then upload it.
 *
 * Phone photos are routinely 4-8 MB at 4000px wide. Sending that untouched
 * would waste storage and, worse, make every visitor download it - egress is
 * the binding limit on the free tier. Re-encoding to a sensible edge length and
 * stepping the JPEG quality down until it fits the budget keeps the page light.
 *
 * HEIC and TIFF are converted first, so an iPhone portrait or a scanned print
 * uploads like anything else. Everything lands as JPEG whatever went in, which
 * is what keeps the public site predictable.
 *
 * Returns { url, error } and never throws.
 */
export async function uploadImage(file, { maxEdge = 1600, maxBytes = 500 * 1024 } = {}) {
  if (!file) return { error: 'No file selected.' }

  if (RAW_EXTENSIONS.test(file.name)) {
    return {
      error: 'Camera RAW files cannot be read in a browser. Please export a JPEG and upload that.',
    }
  }

  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    return { error: `That image is ${prettyMB(file.size)}. Please pick one under 25 MB.` }
  }

  const format = await sniffImageFormat(file)
  if (!format) {
    return {
      error:
        'That file does not look like an image. JPG, PNG, HEIC, WebP, AVIF, GIF, BMP and TIFF all work.',
    }
  }

  try {
    const source = await decodeImage(file, format)
    const { width, height } = sizeOf(source)

    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    if (!canvas.width || !canvas.height) return { error: 'That image could not be read.' }

    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    // ImageBitmaps hold their decoded pixels until explicitly released, and a
    // 12 MP photo is ~48 MB of them - worth closing when several are uploaded
    // one after another.
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()

    // Step the quality down rather than guessing once: the same pixel count
    // compresses very differently depending on the subject.
    let blob = null
    for (const quality of [0.88, 0.8, 0.72, 0.6, 0.5]) {
      blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) break
    }
    if (!blob) return { error: 'That image could not be processed.' }

    return await putObject(`${crypto.randomUUID()}.jpg`, blob, 'image/jpeg')
  } catch (err) {
    console.error('[storage] image upload failed', format, err)

    // Name the format that failed. The old message said "Try a JPG or PNG" for
    // every cause alike, which sent the owner hunting through their photo
    // library when the real problem was a Content-Security-Policy rule.
    if (format === 'heic') {
      return {
        error: 'That iPhone photo could not be converted. Please export it as JPEG and try again.',
      }
    }
    return { error: `That ${format.toUpperCase()} image could not be read. Try a JPG or PNG.` }
  }
}




// ---------------------------------------------------------------------------
//  Usage
// ---------------------------------------------------------------------------

/**
 * Add up everything stored in the bucket.
 *
 * Listing requires owner access (the anonymous list policy was removed - see
 * supabase/migration-storage-listing.sql), which is fine: only the dashboard
 * ever asks.
 *
 * Returns { bytes, files, error }. On failure it reports zero rather than
 * throwing, so a meter that cannot load never blocks an upload.
 */
/** Every object in the bucket. Returns { all, error } and never throws. */
async function listAllObjects() {
  const all = []
  const pageSize = 100

  for (let offset = 0; offset < 2000; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: pageSize, offset })

    if (error) {
      console.error('[storage] could not list the bucket', error.message)
      return { all: [], error: error.message }
    }
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
  }

  return { all, error: null }
}

const sizeOfObject = (file) => file.metadata?.size ?? 0

export async function getStorageUsage() {
  const { all, error } = await listAllObjects()
  if (error) return { bytes: 0, files: 0, error }

  return { bytes: all.reduce((total, f) => total + sizeOfObject(f), 0), files: all.length, error: null }
}

// ---------------------------------------------------------------------------
//  Unreferenced files
// ---------------------------------------------------------------------------

/**
 * A file may be uploaded and then never referenced by anything.
 *
 * The pickers upload on selection rather than on submit, so choosing a video
 * and then closing the form without saving leaves the file behind. So does a
 * replaced video whose delete was refused. Nothing in the dashboard lists those
 * files, yet they count against the storage budget - which reads as "deleting
 * my work did not free any space", because the space in question belongs to
 * uploads that were never part of any entry.
 *
 * Anything newer than the grace window is left alone: it may well belong to a
 * form that is open in another tab right now, still being filled in.
 */
export async function findUnreferencedFiles({ graceMinutes = 60 } = {}) {
  const empty = { files: [], bytes: 0, error: null }

  const { all, error } = await listAllObjects()
  if (error) return { ...empty, error }

  const referenced = new Set()
  const reference = (url) => {
    const path = storagePathFromUrl(url)
    if (path) referenced.add(path)
  }

  // Every table that can point at a stored file must be read successfully.
  // Deleting on the strength of an incomplete reference list would remove a
  // file that is still in use, so any failure here aborts rather than guesses.
  const { data: items, error: itemsError } = await supabase
    .from('portfolio_items')
    .select('video_url, thumbnail_url')
  if (itemsError) return { ...empty, error: itemsError.message }
  items?.forEach((row) => {
    reference(row.video_url)
    reference(row.thumbnail_url)
  })

  const { data: about, error: aboutError } = await supabase
    .from('about_content')
    .select('photo_url')
  // A table that does not exist yet holds no references, which is safe. Any
  // other failure is not.
  if (aboutError && !isMissingTable(aboutError)) return { ...empty, error: aboutError.message }
  about?.forEach((row) => reference(row.photo_url))

  const cutoff = Date.now() - graceMinutes * 60 * 1000
  const orphans = all.filter((file) => {
    if (file.name.startsWith('.')) return false // Supabase's own folder markers
    if (referenced.has(file.name)) return false
    const created = Date.parse(file.created_at || file.updated_at || '')
    return Number.isFinite(created) ? created < cutoff : true
  })

  return {
    files: orphans.map((f) => ({ name: f.name, size: sizeOfObject(f) })),
    bytes: orphans.reduce((total, f) => total + sizeOfObject(f), 0),
    error: null,
  }
}

/**
 * Permanently remove the given object paths. Returns { removed, error }.
 *
 * Batched because Supabase caps how many paths one remove() call accepts, and a
 * long-running dashboard could accumulate more orphans than that.
 */
export async function deleteStoredPaths(paths) {
  let removed = 0

  for (let i = 0; i < paths.length; i += 50) {
    const batch = paths.slice(i, i + 50)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error('[storage] could not remove', batch, error.message)
      return { removed, error: error.message }
    }
    removed += batch.length
  }

  return { removed, error: null }
}
