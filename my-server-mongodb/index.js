<<<<<<< HEAD
require("dotenv").config();
const express = require("express");
=======
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

>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac
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

<<<<<<< HEAD
const { MongoClient, ObjectId } = require("mongodb");

let productsCollection;
let productAssetsCollection;
let usersCollection;

app.get("/", (req, res) => {
    res.send("Floralia Web Server is running");
=======
app.get('/', (req, res) => {
    res.send('Floralia Web Server is running');
>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac
});

// API đăng ký, đăng nhập
app.use('/api/auth', authRoutes);

<<<<<<< HEAD
        const thumbnails = [
            ...new Set(
                products
                    .map(product => product.thumbnail)
                    .filter(Boolean)
                    .map(String)
            )
        ];
        const thumbnailIds = thumbnails
            .filter(ObjectId.isValid)
            .map(thumbnail => new ObjectId(thumbnail));
        const assets = await productAssetsCollection
            .find({
                $or: [
                    { _id: { $in: thumbnailIds } },
                    { assetId: { $in: thumbnails } },
                    { originalFileName: { $in: thumbnails } }
                ]
            })
            .project({ assetId: 1, originalFileName: 1, mimeType: 1, data: 1 })
            .toArray();

        const result = products.map(product => {
            const thumbnail = product.thumbnail;

            const asset = assets.find(item =>
                String(item._id) === String(thumbnail) ||
                String(item.assetId) === String(thumbnail) ||
                String(item.originalFileName) === String(thumbnail)
            );

            return {
                ...product,
                imageData: asset?.data ?? null,
                imageMimeType: asset?.mimeType ?? null
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Lỗi lấy danh sách sản phẩm:", error);

        res.status(500).json({
            message: "Không thể lấy danh sách sản phẩm"
        });
    }
});

// API lấy chi tiết một sản phẩm theo ID
app.get("/products/:id", async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "ID sản phẩm không hợp lệ"
            });
        }

        const product = await productsCollection.findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!product) {
            return res.status(404).json({
                message: "Không tìm thấy sản phẩm"
            });
        }

        const thumbnail = product.thumbnail;

        let asset = null;

        if (ObjectId.isValid(String(thumbnail))) {
            asset = await productAssetsCollection.findOne({
                _id: new ObjectId(String(thumbnail))
            });
        }

        if (!asset) {
            asset = await productAssetsCollection.findOne({
                assetId: thumbnail
            });
        }

        if (!asset) {
            asset = await productAssetsCollection.findOne({
                originalFileName: thumbnail
            });
        }

        res.json({
            ...product,
            imageData: asset && asset.data ? asset.data : null,
            imageMimeType: asset ? asset.mimeType : null
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết sản phẩm:", error);

        res.status(500).json({
            message: "Không thể lấy chi tiết sản phẩm"
        });
    }
});

// Khởi động server và kết nối MongoDB
=======
// API sản phẩm
app.use('/products', productRoutes);

>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac
async function startServer() {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error("Thiếu MONGODB_URI. Hãy cấu hình URI MongoDB Atlas trong file .env.");
        }

        const client = new MongoClient(mongoUri);
        await client.connect();

        const db = client.db('FloraliaTea');

<<<<<<< HEAD
        productsCollection = db.collection("Product");
        productAssetsCollection = db.collection("ProductAssets");
        usersCollection = db.collection("Users");
=======
        User.setCollection(db.collection('Users'));

        // Hai collection được quản lý trong models/product.js
        Product.setCollections(
            db.collection('Product'),
            db.collection('ProductAssets')
        );

        await db.collection('Users').createIndex(
            { email: 1 },
            { unique: true }
        );
>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac

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