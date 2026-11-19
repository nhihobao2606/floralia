const path = require('path');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

async function fix() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    return;
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'FloraliaTea');
    const ordersCol = db.collection('Orders');
    
    const orders = await ordersCol.find({}).toArray();
    console.log('Total orders in DB:', orders.length);
    let updatedCount = 0;
    
    for (const order of orders) {
      if (!Array.isArray(order.items)) continue;
      let modified = false;
      const updatedItems = order.items.map(it => {
        if (typeof it.image === 'string' && (it.image.includes('localhost:3002') || it.image.includes('127.0.0.1:3002'))) {
          modified = true;
          return { ...it, image: it.image.replace(/http:\/\/(?:localhost|127\.0\.0\.1):3002/g, 'https://floralia-1.onrender.com') };
        }
        return it;
      });
      if (modified) {
        await ordersCol.updateOne({ _id: order._id }, { $set: { items: updatedItems } });
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} orders containing localhost:3002 images!`);

    const cartCol = db.collection('Cart');
    const carts = await cartCol.find({}).toArray();
    let updatedCarts = 0;
    for (const cart of carts) {
      if (!Array.isArray(cart.items)) continue;
      let modified = false;
      const updatedItems = cart.items.map(it => {
        if (typeof it.image === 'string' && (it.image.includes('localhost:3002') || it.image.includes('127.0.0.1:3002'))) {
          modified = true;
          return { ...it, image: it.image.replace(/http:\/\/(?:localhost|127\.0\.0\.1):3002/g, 'https://floralia-1.onrender.com') };
        }
        return it;
      });
      if (modified) {
        await cartCol.updateOne({ _id: cart._id }, { $set: { items: updatedItems } });
        updatedCarts++;
      }
    }
    console.log(`Updated ${updatedCarts} carts containing localhost:3002 images!`);
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.close();
  }
}

fix();
