const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (db) {
    const router = express.Router();
    const productsCollection = db.collection("Product");
    const productAssetsCollection = db.collection("ProductAssets");

    // GET /products (Lấy danh sách tất cả sản phẩm)
    router.get("/", async (req, res) => {
        try {
            const products = await productsCollection.find({}).toArray();
            const assets = await productAssetsCollection.find({}).toArray();

            const result = products.map(product => {
                const thumbnail = product.thumbnail;
                const asset = assets.find(item =>
                    String(item._id) === String(thumbnail) ||
                    String(item.assetId) === String(thumbnail) ||
                    String(item.originalFileName) === String(thumbnail)
                );

                return {
                    ...product,
                    imageData: asset && asset.data ? asset.data : null,
                    imageMimeType: asset ? asset.mimeType : null
                };
            });

            res.json(result);
        } catch (error) {
            console.error("Lỗi lấy danh sách sản phẩm:", error);
            res.status(500).json({ message: "Không thể lấy danh sách sản phẩm" });
        }
    });

    // GET /products/slug/:slug (Lấy theo Slug cho Angular)
    router.get("/slug/:slug", async (req, res) => {
        try {
            const product = await productsCollection.findOne({ slug: req.params.slug });

            if (!product) {
                return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
            }

            const thumbnail = product.thumbnail;
            let asset = null;

            if (ObjectId.isValid(String(thumbnail))) {
                asset = await productAssetsCollection.findOne({ _id: new ObjectId(String(thumbnail)) });
            }
            if (!asset) asset = await productAssetsCollection.findOne({ assetId: thumbnail });
            if (!asset) asset = await productAssetsCollection.findOne({ originalFileName: thumbnail });

            res.json({
                ...product,
                imageData: asset && asset.data ? asset.data : null,
                imageMimeType: asset ? asset.mimeType : null
            });
        } catch (error) {
            console.error("Lỗi lấy chi tiết sản phẩm:", error);
            res.status(500).json({ message: "Không thể lấy chi tiết sản phẩm" });
        }
    });

    // GET /products/:id (Lấy theo ObjectId)
    router.get("/:id", async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ message: "ID không hợp lệ" });
            }

            const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
            if (!product) {
                return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
            }

            const thumbnail = product.thumbnail;
            let asset = null;

            if (ObjectId.isValid(String(thumbnail))) {
                asset = await productAssetsCollection.findOne({ _id: new ObjectId(String(thumbnail)) });
            }
            if (!asset) asset = await productAssetsCollection.findOne({ assetId: thumbnail });
            if (!asset) asset = await productAssetsCollection.findOne({ originalFileName: thumbnail });

            res.json({
                ...product,
                imageData: asset && asset.data ? asset.data : null,
                imageMimeType: asset ? asset.mimeType : null
            });
        } catch (error) {
            console.error("Lỗi lấy chi tiết sản phẩm:", error);
            res.status(500).json({ message: "Không thể lấy chi tiết sản phẩm" });
        }
    });

    return router;
};