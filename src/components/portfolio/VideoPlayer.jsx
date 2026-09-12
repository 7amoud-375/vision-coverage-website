/**
 * Plays an uploaded portfolio video.
 *
 * `preload="metadata"` is deliberate and important: it fetches a few kilobytes
 * of header rather than the whole file, so opening the lightbox costs almost
 * nothing until the visitor actually presses play. On a free hosting tier where
 * bandwidth is the binding limit, that difference is the whole ball game.
 */
export default function VideoPlayer({ src, poster, title }) {
  return (
    <video
      className="max-h-[75vh] w-full rounded-lg bg-black"
      src={src}
      poster={poster || undefined}
      controls
      autoPlay
      playsInline
      preload="metadata"
      controlsList="nodownload"
      aria-label={title}
    />
  )
}
