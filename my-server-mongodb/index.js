const path = require('path');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const User = require('./models/user');
const Product = require('./models/product');
const Blog = require('./models/blog');
const Order = require('./models/order');
const Voucher = require('./models/voucher');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const clientProductRoutes = require('./routes/clientProductRoutes');
const addressRoutes = require('./routes/addressRoutes');
const blogRoutes = require('./routes/blogRoutes');
const adminBlogRoutes = require('./routes/adminBlogRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminProductRoutes = require('./routes/adminProductRoutes');
const AdminProduct = require('./models/adminProduct');
const voucherRoutes = require('./routes/voucherRoutes');
const adminOrderRoutes = require('./routes/adminOrderRoutes');

const app = express();
const port = process.env.PORT || 3002;

app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

app.get('/', (req, res) => {
    res.send('Floralia Web Server is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/products', clientProductRoutes);
app.use('/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/blogs', blogRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/admin/orders', adminOrderRoutes);

async function startServer() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Thiếu MONGODB_URI trong file .env.');
    }
    if (!process.env.JWT_SECRET?.trim()) {
        throw new Error('Thiếu JWT_SECRET trong file .env.');
    }

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || 'FloraliaTea');

        User.setCollection(db.collection('Users'));
        Product.setCollections(
            db.collection('Product'),
            db.collection('ProductAssets'),
            db.collection('Reviews')
        );
        AdminProduct.setCollections(db.collection('Product'), db.collection('ProductAssets'));
        Blog.setCollection(db.collection('Blogs'));

        Order.setCollection(db.collection('Orders'));
        Voucher.setCollection(db.collection('Vouchers'));

        await db.collection('Users').createIndex({ email: 1 }, { unique: true });
        await db.collection('Orders').createIndex({ id: 1 });
        await db.collection('Orders').createIndex({ code: 1 });
        await db.collection('Orders').createIndex({ orderCode: 1 });
        await db.collection('Orders').createIndex({ 'receiver.phone': 1, status: 1, createdAt: -1 });
        await db.collection('Orders').createIndex({ userId: 1, createdAt: -1 });
        await db.collection('Orders').createIndex({ userId: 1, status: 1, createdAt: -1 });
        await db.collection('Orders').createIndex({ createdAt: -1 });
        await db.collection('Orders').createIndex({ status: 1, createdAt: -1 });
        await db.collection('ProductAssets').createIndex({ assetId: 1 });
        await db.collection('ProductAssets').createIndex({ originalFileName: 1 });
        await db.command({ ping: 1 });

        app.listen(port, () => {
            console.log('Floralia server connected to MongoDB (' + db.databaseName + ') and listening on port ' + port);
        });

        process.once('SIGINT', async () => {
            await client.close();
            process.exit(0);
        });
        process.once('SIGTERM', async () => {
            await client.close();
            process.exit(0);
        });
    } catch (error) {
        console.error('Không thể khởi động server:', error);
        await client.close().catch((closeError) => {
            console.error('Không thể đóng kết nối MongoDB:', closeError);
        });
        process.exitCode = 1;
    }
}

startServer();
