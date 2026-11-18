const path = require('path');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const { buildProductSearchText, embedText } = require('../services/geminiService');

async function sync() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI missing in .env');
    }
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || 'FloraliaTea');
        const collection = db.collection('Product');

        const products = await collection.find({ isActive: { $ne: false } }).toArray();
        console.log(`Tìm thấy ${products.length} sản phẩm hoạt động. Bắt đầu tạo embedding...`);

        let updated = 0;
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            const searchText = buildProductSearchText(p);
            try {
                process.stdout.write(`[${i + 1}/${products.length}] Đang embed: ${p.name}... `);
                const vector = await embedText(searchText);
                if (Array.isArray(vector) && vector.length === 768) {
                    await collection.updateOne(
                        { _id: p._id },
                        {
                            $set: {
                                search_text: searchText,
                                embedding: vector,
                                embeddingUpdatedAt: new Date()
                            }
                        }
                    );
                    updated++;
                    console.log('Xong! (768 dims)');
                } else {
                    console.log('Thất bại: vector không đúng 768 chiều');
                }
            } catch (err) {
                console.log('Lỗi:', err.message);
            }
            // Delay nhỏ 100ms tránh rate limit
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`\n Hoàn tất đồng bộ embeddings: ${updated}/${products.length} sản phẩm thành công.`);
    } catch (e) {
        console.error('Lỗi sync:', e);
    } finally {
        await client.close();
    }
}

sync();
