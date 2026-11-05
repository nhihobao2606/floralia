import { blogDetailLink } from './blog-url';

describe('blogDetailLink', () => {
  it('builds a detail route with the category and article slugs', () => {
    expect(blogDetailLink({
      category: 'Văn hóa trà',
      categorySlug: 'van-hoa-tra',
      slug: 'cau-chuyen-tra',
    })).toEqual(['/blog', 'van-hoa-tra', 'cau-chuyen-tra']);
  });

  it('generates a category slug for older blogs without one', () => {
    expect(blogDetailLink({
      category: 'Bí quyết pha trà',
      categorySlug: '',
      slug: 'huong-dan',
    })).toEqual(['/blog', 'bi-quyet-pha-tra', 'huong-dan']);
  });
});
