
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PRODUCTS_FILE = path.resolve(
  'src/app/data/products.json'
);

const IMAGE_DIR = path.resolve(
  'src/app/assets/images/products'
);

const OUTPUT_PRODUCTS = path.resolve(
  'src/app/data/products.updated.json'
);

const OUTPUT_ASSETS = path.resolve(
  'src/app/data/product_assets.json'
);

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function getMimeType(ext) {
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };

  return types[ext.toLowerCase()] || 'application/octet-stream';
}

async function main() {
  const products = JSON.parse(
    fs.readFileSync(PRODUCTS_FILE, 'utf8')
  );

  const files = fs.readdirSync(IMAGE_DIR)
    .filter(file =>
      IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );

  const assets = [];
  const errors = [];

  for (const product of products) {
    if (!product.thumbnail) {
      errors.push(`${product.sku}: chưa có thumbnail`);
      continue;
    }

    const thumbnailName = path.basename(
      String(product.thumbnail)
    );

    const thumbnailStem = path.parse(thumbnailName).name;

    const mainFile = files.find(
      file => file.toLowerCase() === thumbnailName.toLowerCase()
    );

    if (!mainFile) {
      errors.push(
        `${product.sku}: không tìm thấy ${thumbnailName}`
      );
      continue;
    }

    // Chỉ lấy đúng nhóm: 3.png, 3_1.png, 3_2.png...
    const groupPattern = new RegExp(
      `^${thumbnailStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:_(\\d+))?$`,
      'i'
    );

    const groupFiles = files
      .filter(file =>
        groupPattern.test(path.parse(file).name)
      )
      .sort((a, b) => {
        const aMatch = path.parse(a).name.match(/_(\d+)$/);
        const bMatch = path.parse(b).name.match(/_(\d+)$/);

        const aNumber = aMatch ? Number(aMatch[1]) : 0;
        const bNumber = bMatch ? Number(bMatch[1]) : 0;

        return aNumber - bNumber;
      });

    const thumbnailId = `${product.sku}_THUMB`;
    const imageIds = [];

    // Tạo thumbnail WebP nhỏ hơn để tải nhanh
    const thumbnailBuffer = await sharp(
      path.join(IMAGE_DIR, mainFile)
    )
      .rotate()
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    assets.push({
      assetId: thumbnailId,
      productSku: product.sku,
      originalFileName: mainFile,
      type: 'thumbnail',
      mimeType: 'image/webp',
      data: thumbnailBuffer.toString('base64')
    });

    // Lưu ảnh chi tiết, tối ưu thành WebP
    for (let i = 0; i < groupFiles.length; i++) {
      const file = groupFiles[i];
      const imageId = `${product.sku}_IMG_${i + 1}`;

      const imageBuffer = await sharp(
        path.join(IMAGE_DIR, file)
      )
        .rotate()
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toBuffer();

      assets.push({
        assetId: imageId,
        productSku: product.sku,
        originalFileName: file,
        type: 'image',
        mimeType: 'image/webp',
        data: imageBuffer.toString('base64')
      });

      imageIds.push(imageId);
    }

    // Thay tên file bằng ID ảnh trong dữ liệu sản phẩm
    product.thumbnail = thumbnailId;
    product.images = imageIds;

    console.log(
      `${product.sku}: ${mainFile} + ${groupFiles.length - 1} ảnh phụ`
    );
  }

  // Xuất file mới, không ghi đè dữ liệu gốc
  fs.writeFileSync(
    OUTPUT_ASSETS,
    JSON.stringify(assets, null, 2)
  );

  fs.writeFileSync(
    OUTPUT_PRODUCTS,
    JSON.stringify(products, null, 2)
  );

  console.log('\nĐã tạo product_assets.json');
  console.log('Đã tạo products.updated.json');
  console.log(`Tổng bản ghi ảnh: ${assets.length}`);

  if (errors.length) {
    console.log('\nCác trường hợp cần kiểm tra:');
    errors.forEach(error => console.log('- ' + error));
  }
}

main().catch(console.error);
