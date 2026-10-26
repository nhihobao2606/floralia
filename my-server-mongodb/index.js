const express = require("express");
const app = express();
const port = 3002;

const morgan = require("morgan");
app.use(morgan("combined"));

const path = require("path");
const fs = require("fs");
app.use(express.static(path.join(__dirname, "public")));

const cors = require("cors");
app.use(cors());

const bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const { MongoClient, ObjectId } = require("mongodb");

const client = new MongoClient("mongodb://127.0.0.1:27017");

let productsCollection;
let productAssetsCollection;
let usersCollection;

app.get("/", (req, res) => {
    res.send("Floralia Web Server is running");
});

// API lấy danh sách sản phẩm và hình ảnh
app.get("/products", async (req, res) => {
    try {
        const products = await productsCollection
            .find({})
            .toArray();

        const assets = await productAssetsCollection
            .find({})
            .toArray();

        const result = products.map(product => {
            const thumbnail = product.thumbnail;

            const asset = assets.find(item =>
                String(item._id) === String(thumbnail) ||
                String(item.assetId) === String(thumbnail) ||
                String(item.originalFileName) === String(thumbnail)
            );

            let imageData = null;

            if (asset && asset.data) {
                imageData = asset.data;
            }

            return {
                ...product,
                imageData: imageData,
                imageMimeType: asset ? asset.mimeType : null
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
async function startServer() {
    try {
        await client.connect();

        const db = client.db("FloraliaTea");

        productsCollection = db.collection("Products");
        productAssetsCollection = db.collection("ProductAssets");
        usersCollection = db.collection("Users");

        await db.command({ ping: 1 });

        console.log("Đã kết nối MongoDB: FloraliaTea");

        app.listen(port, () => {
            console.log(`Floralia Server listening on port ${port}`);
        });
    } catch (error) {
        console.error("Không thể kết nối MongoDB:", error);
        process.exit(1);
    }
}

startServer();
