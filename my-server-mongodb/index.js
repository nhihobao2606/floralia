require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const User = require('./models/user');
const Product = require('./models/product');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
const port = 3002;

const client = new MongoClient(process.env.MONGODB_URI);

app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({
    limit: '50mb',
    extended: true
}));

app.get('/', (req, res) => {
    res.send('Floralia Web Server is running');
});

// API đăng ký, đăng nhập
app.use('/api/auth', authRoutes);

// API sản phẩm
app.use('/products', productRoutes);

async function startServer() {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error("Thiếu MONGODB_URI. Hãy cấu hình URI MongoDB Atlas trong file .env.");
        }

        const client = new MongoClient(mongoUri);
        await client.connect();

        const db = client.db('FloraliaTea');

        User.setCollection(db.collection('Users'));

        // Hai collection được quản lý trong models/product.js
        Product.setCollections(
            db.collection('Product'),
            db.collection('ProductAssets'),
            db.collection('Reviews')
        );

        await db.collection('Users').createIndex(
            { email: 1 },
            { unique: true }
        );

        await db.command({ ping: 1 });

        console.log('Đã kết nối MongoDB: FloraliaTea');

        app.listen(port, () => {
            console.log(`Floralia Server listening on port ${port}`);
        });
    } catch (error) {
        console.error('Không thể khởi động server:', error);
        process.exit(1);
    }
}

startServer();