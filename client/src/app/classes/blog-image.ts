import { Blog } from './Blog';

const LOW_RES_SEEDED_BLOG_IMAGES = new Set([
  '/assets/images/bl4.jpg',
  '/assets/images/bl5.jpg',
  '/assets/images/bl6.jpg',
]);

/** Use the full-size public originals when MongoDB still contains the old 145px seed thumbnails. */
export function blogImageSource(blog: Blog | null | undefined): string {
  if (!blog) return '/assets/images/bl1.jpg';

  const imagePath = (blog.image || '').split('?')[0];
  const imageData = blog.imageData || '';
  if (
    LOW_RES_SEEDED_BLOG_IMAGES.has(imagePath) &&
    imageData.length > 0 && imageData.length < 30_000
  ) {
    return `${imagePath}?v=high-resolution-2`;
  }

  if (imageData) {
    if (imageData.startsWith('data:image/')) return imageData;
    return `data:${blog.imageMimeType || 'image/jpeg'};base64,${imageData}`;
  }

  return blog.image || '/assets/images/bl1.jpg';
}
