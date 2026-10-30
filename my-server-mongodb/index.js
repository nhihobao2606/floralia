const path = require("path");
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const User = require("./models/user");
const Product = require("./models/product");
const Blog = require("./models/blog");
const Order = require("./models/order");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const addressRoutes = require("./routes/addressRoutes");
const blogRoutes = require("./routes/blogRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const port = 3002;

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

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/products", productRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/blogs", blogRoutes);
app.use("/api/orders", orderRoutes);

async function startServer() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("Thiếu MONGODB_URI. Hãy cấu hình URI MongoDB trong file .env.");
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
        throw new Error("Thiếu JWT_SECRET. Hãy cấu hình JWT_SECRET trong file .env.");
    }

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();

        const db = client.db(process.env.DB_NAME || "FloraliaTea");

        User.setCollection(db.collection("Users"));
        Product.setCollections(
            db.collection("Product"),
            db.collection("ProductAssets"),
            db.collection("Reviews")
        );
        Blog.setCollection(db.collection("Blogs"));

        Order.setCollection(db.collection("Orders"));
        const orderCount = await Order.count();
        if (orderCount === 0) {
            const { initialOrders } = require("./controllers/orderController");
            await Order.insertMany(initialOrders);
            console.log("Đã nạp dữ liệu đơn hàng mẫu vào MongoDB: FloraliaTea.Orders");
        }

        await db.collection("Users").createIndex(
            { email: 1 },
            { unique: true }
        );
        await db.collection("ProductAssets").createIndex({ assetId: 1 });
        await db.collection("ProductAssets").createIndex({ originalFileName: 1 });
        await db.command({ ping: 1 });

        console.log("Đã kết nối MongoDB:", db.databaseName);

        app.listen(port, () => {
            console.log(`Floralia Server listening on port ${port}`);
        });
    } catch (error) {
        console.error("Không thể khởi động server:", error);
        await client.close().catch(closeError => {
            console.error("Không thể đóng kết nối MongoDB:", closeError);
        });
        process.exitCode = 1;
    }
}

startServer().catch(error => {
    console.error("Không thể khởi động server:", error);
    process.exitCode = 1;
});
