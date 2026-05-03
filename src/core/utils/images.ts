/**
 * Optimizes an image URL using the free wsrv.nl proxy.
 * This resizes and converts images to WebP on the fly to save user data.
 */
export function optimizeImage(url: string, width: number = 400): string {
  if (!url) return url;
  
  // Only optimize external images (TMDB, etc.)
  if (url.startsWith('http')) {
    // wsrv.nl parameters:
    // url: the encoded source image
    // w: width in pixels
    // output: format (webp is highly efficient)
    // q: quality (80 is a good sweet spot)
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=80`;
  }
  
  return url;
}
