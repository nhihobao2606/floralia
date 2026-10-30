const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const User = require('./models/user');
const Product = require('./models/product');
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const addressRoutes = require('./routes/addressRoutes');

const express = require("express");
const app = express();
const port = 3002;

const morgan = require("morgan");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const User = require("./models/user");
const Product = require("./models/product");
const Blog = require("./models/blog");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const blogRoutes = require("./routes/blogRoutes");

app.use(morgan("combined"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({
    limit: "50mb",
    extended: true
}));

app.get("/", (req, res) => {
    res.send("Floralia Web Server is running");
});

// API đăng ký, đăng nhập
app.use('/api/auth', authRoutes);

// API người dùng (profile, đổi mật khẩu)
app.use('/api/users', userRoutes);

// API sản phẩm
app.use('/products', productRoutes);

// API địa chỉ
app.use('/api/addresses', addressRoutes);
app.use("/api/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/blogs", blogRoutes);

if (!process.env.MONGODB_URI) {
    console.error("Thiếu MONGODB_URI trong file .env");
    process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error("Thiếu MONGODB_URI. Hãy cấu hình URI MongoDB Atlas trong file .env.");
        }

        if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
            throw new Error("Thiếu JWT_SECRET. Hãy cấu hình JWT_SECRET trong file .env.");
        }

        const client = new MongoClient(mongoUri);
        await client.connect();

        const db = client.db(process.env.DB_NAME || "FloraliaTea");

        User.setCollection(db.collection("Users"));
        Product.setCollections(
            db.collection('Product'),
            db.collection('ProductAssets'),
            db.collection('Reviews')
            db.collection("Product"),
            db.collection("ProductAssets")
        );
        Blog.setCollection(db.collection("Blogs"));

        await db.collection("Users").createIndex(
            { email: 1 },
            { unique: true }
        );

        await db.command({ ping: 1 });

        console.log("Đã kết nối MongoDB:", db.databaseName);

        app.listen(port, () => {
            console.log(`Floralia Server listening on port ${port}`);
        });
    } catch (error) {
        console.error("Không thể khởi động server:", error);
        process.exit(1);
    }
}

startServer();

