const Product = require('./product');

function quantitiesBySku(items) {
  const quantities = new Map();
  for (const item of items) {
    const sku = String(item.sku || '').trim();
    if (sku) quantities.set(sku, (quantities.get(sku) || 0) + Number(item.quantity || 0));
  }
  return [...quantities];
}

async function incrementSoldCounts(items, session) {
  const entries = quantitiesBySku(items);
  const missingSkus = [];
  for (const [sku, quantity] of entries) {
    const result = await Product.incrementSoldBySku(sku, quantity, session);
    if (result.matchedCount === 0) missingSkus.push(sku);
  }
  if (session && missingSkus.length) {
    throw new Error(`Cannot increment sold count for SKU(s): ${missingSkus.join(', ')}`);
  }
  return missingSkus;
}

async function decrementSoldCounts(items, session) {
  const entries = quantitiesBySku(items);
  for (const [sku, quantity] of entries) {
    const result = await Product.decrementSoldBySku(sku, quantity, session);
    if (result.matchedCount !== 1) {
      throw new Error(`Cannot restore sold count for SKU ${sku}`);
    }
  }
}

module.exports = { incrementSoldCounts, decrementSoldCounts };
