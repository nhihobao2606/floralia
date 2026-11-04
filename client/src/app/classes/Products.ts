export interface Products {
  _id?: string;
  id?: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  featured: boolean;
  price: number;
  oldPrice: number;
  minPrice: number;
  discount: number;
  isSale: boolean;
  stock: number;
  sold: number;
  thumbnail: string;
  imageUrl?: string | null;
  imageId?: string | null;
  imageData?: string | null;
  imageMimeType?: string | null;
  images: string[];
  ratingAverage: number;
  ratingCount: number;
  isActive?: boolean;
  description: string;
  tags: string[];
  benefits: string[];
  variants: {
    sku: string;
    label: string;
    price: number;
    oldPrice: number;
    stock: number;
    isDefault: boolean;
  }[];
}