const Product = require('./product');

async function incrementSoldCounts(items) {
  const quantitiesBySku = new Map();
  for (const item of items) {
    const sku = item.sku.trim();
    quantitiesBySku.set(sku, (quantitiesBySku.get(sku) || 0) + item.quantity);
  }

  const entries = [...quantitiesBySku];
  const updates = await Promise.all(
    entries.map(([sku, quantity]) => Product.incrementSoldBySku(sku, quantity))
  );

  return updates.reduce((missingSkus, result, index) => {
    if (result.matchedCount === 0) {
      missingSkus.push(entries[index][0]);
    }
    return missingSkus;
  }, []);
}

module.exports = { incrementSoldCounts };
