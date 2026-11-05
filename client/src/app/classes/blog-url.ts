import { Blog } from './Blog';

type BlogLinkData = Pick<Blog, 'category' | 'categorySlug' | 'slug'>;

function slugifyCategory(category: string): string {
  return category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function blogDetailLink(blog: BlogLinkData): string[] {
  const categorySlug = blog.categorySlug?.trim() || slugifyCategory(blog.category) || 'danh-muc';
  return ['/blog', categorySlug, blog.slug];
}
