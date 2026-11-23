/**
 * Reads an image file into a downscaled data URL.
 *
 * Used for the gym logo and the account avatar: neither has a file server behind it,
 * so the image travels inside the record. Downscaling keeps the payload a few
 * kilobytes instead of megabytes.
 */

/** Source images above this size are refused before any decoding happens. */
export const MAX_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024

export async function fileToImageDataUrl(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable in this browser.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // WEBP keeps transparency and stays small; browsers without an encoder fall back to PNG.
  const encoded = canvas.toDataURL('image/webp', 0.82)
  return encoded.startsWith('data:image/webp') ? encoded : canvas.toDataURL('image/png')
}
