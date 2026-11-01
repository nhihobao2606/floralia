const { ObjectId } = require("mongodb");
const Blog = require("../models/blog");

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getBlogs(req, res) {
    try {
        const { featured, category, q, limit, page } = req.query;
        const filter = {};
        const conditions = [{
            $or: [
                { status: "published" },
                { status: { $exists: false } }
            ]
        }];

        if (featured === "true") {
            filter.featured = true;
        }

        if (category && category !== "all" && category !== "tat-ca") {
            conditions.push({
                $or: [
                    { category },
                    { categorySlug: category }
                ]
            });
        }

        if (typeof q === "string" && q.trim()) {
            const regex = new RegExp(escapeRegex(q.trim()), "i");
            conditions.push({
                $or: [
                    { title: regex },
                    { excerpt: regex }
                ]
            });
        }

        if (conditions.length) {
            filter.$and = conditions;
        }

        let query = Blog.find(filter).sort({ publishedAt: 1, _id: 1 });
        const total = await Blog.countDocuments(filter);

        if (page && limit) {
            const pageNum = Math.max(1, parseInt(page, 10));
            const limitNum = Math.max(1, parseInt(limit, 10));
            query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
        } else if (limit) {
            query = query.limit(parseInt(limit, 10));
        }

        const blogs = await query.toArray();

        res.json({
            data: blogs,
            total,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : total
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách blog:", error);
        res.status(500).json({
            message: "Không thể lấy danh sách bài viết"
        });
    }
}

async function getBlogByIdentifier(req, res) {
    try {
        const identifier = req.params.identifier;
        let blog = null;

        if (ObjectId.isValid(identifier)) {
            blog = await Blog.findOneAndUpdate(
                {
                    $and: [
                        { $or: [{ status: "published" }, { status: { $exists: false } }] },
                        { $or: [{ _id: new ObjectId(identifier) }, { slug: identifier }] }
                    ]
                },
                { $inc: { views: 1 } },
                { returnDocument: "after" }
            );
        } else {
            blog = await Blog.findOneAndUpdate(
                {
                    slug: identifier,
                    $or: [{ status: "published" }, { status: { $exists: false } }]
                },
                { $inc: { views: 1 } },
                { returnDocument: "after" }
            );

            if (!blog) {
                blog = await Blog.findOneAndUpdate(
                    {
                        slug: new RegExp(escapeRegex(identifier), "i"),
                        $or: [{ status: "published" }, { status: { $exists: false } }]
                    },
                    { $inc: { views: 1 } },
                    { returnDocument: "after" }
                );
            }
        }

        if (!blog) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết"
            });
        }

        res.json(blog);
    } catch (error) {
        console.error("Lỗi lấy chi tiết bài viết:", error);
        res.status(500).json({
            message: "Không thể lấy chi tiết bài viết"
        });
    }
}

module.exports = {
    getBlogs,
    getBlogByIdentifier
};
