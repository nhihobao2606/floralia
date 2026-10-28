const mongoose = require('mongoose');

// Định nghĩa schema cho từng biến thể (variant)
const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  label: { type: String, required: true },
  price: { type: Number, required: true },
  oldPrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

// Định nghĩa schema chính cho Sản phẩm
const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  categorySlug: { type: String, required: true, index: true },
  featured: { type: Boolean, default: false },
  price: { type: Number, required: true },
  oldPrice: { type: Number, default: 0 },
  minPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  isSale: { type: Boolean, default: false },
  stock: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  thumbnail: { type: String, default: '' },
  images: [{ type: String }],
  ratingAverage: { type: Number, default: 5 },
  ratingCount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  benefits: [{ type: String }],
  variants: [variantSchema]
}, { 
  timestamps: true, // Tự động tạo createdAt và updatedAt
  collection: 'Product' // Tên collection chính xác trên MongoDB Compass của bạn
});

module.exports = mongoose.model('Product', productSchema);