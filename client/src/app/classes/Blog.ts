export interface Blog {
  _id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole?: string;
  date: string;
  publishedAt?: string | Date;
  category: string;
  categorySlug: string;
  image?: string;
  imageData?: string | null;
  imageMimeType?: string | null;
  featured: boolean;
  views?: number;
  readTime?: string;
  tags?: string[];
}
