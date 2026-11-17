const Order = require('./order');
const Product = require('./product');
const ProductSalesService = require('./product-sales-service');
const AdminProduct = require('./adminProduct');

async function cancelOrderAndRestoreStock(order, updateFields) {
  const inventoryDeducted = order.inventoryDeducted === true;
  const soldCounted = order.soldCounted === true;
  const filter = { id: order.id, status: order.status };
  const fields = { ...updateFields };

  if (!inventoryDeducted && !soldCounted) {
    return Order.findOneAndUpdate(filter, { $set: fields });
  }

  const restoredAt = new Date();
  fields.inventoryDeducted = false;
  fields.soldCounted = false;
  if (inventoryDeducted) fields.stockRestoredAt = restoredAt;
  if (soldCounted) fields.soldCountRestoredAt = restoredAt;

  const updated = await Product.withTransaction(async session => {
    const updated = await Order.findOneAndUpdate(
      { ...filter, ...(inventoryDeducted ? { inventoryDeducted: true } : {}), ...(soldCounted ? { soldCounted: true } : {}) },
      { $set: fields },
      { session }
    );
    if (!updated) return null;

    if (inventoryDeducted) await Product.restoreStockBulk(order.items || [], session);
    if (soldCounted) await ProductSalesService.decrementSoldCounts(order.items || [], session);
    return updated;
  });
  if (updated) AdminProduct.notifyProductChanged('order-cancelled');
  return updated;
}

module.exports = { cancelOrderAndRestoreStock };
