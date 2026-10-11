export const LOCATION_IMAGES_BUCKET = 'location-images';

/** Longest edge of an uploaded photo; the panel shows it at most 320px wide. */
const MAX_EDGE = 1600;

/**
 * Decodes, downsizes and re-encodes a photo as JPEG in the browser. Keeps
 * phone photos well under the bucket's 5 MB limit, applies EXIF rotation, and
 * drops EXIF entirely (including GPS — an editor's phone location shouldn't
 * ship with the picture).
 */
export async function prepareLocationImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}
