const { ObjectId } = require('mongodb');
const Blog = require('../models/blog');

const VALID_STATUSES = new Set(['published', 'draft', 'archived']);

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'bai-viet';
}

function resolveStatus(document) {
    return VALID_STATUSES.has(document.status) ? document.status : 'published';
}

function buildFilter(status, query) {
    const conditions = [];

    if (status === 'published') {
        conditions.push({
            $or: [
                { status: 'published' },
                { status: { $exists: false } }
            ]
        });
    } else if (VALID_STATUSES.has(status)) {
        conditions.push({ status });
    }

    if (query) {
        const regex = new RegExp(escapeRegex(query), 'i');
        const searchFields = [{ title: regex }, { excerpt: regex }];
        if (ObjectId.isValid(query) && query.length === 24) {
            searchFields.push({ _id: new ObjectId(query) });
        }
        searchFields.push({
            $expr: {
                $regexMatch: {
                    input: { $toString: '$_id' },
                    regex: regex.source,
                    options: 'i'
                }
            }
        });
        conditions.push({ $or: searchFields });
    }

    return conditions.length ? { $and: conditions } : {};
}

async function getStats() {
    const grouped = await Blog.aggregate([
        {
            $group: {
                _id: { $ifNull: ['$status', 'published'] },
                count: { $sum: 1 },
                views: { $sum: { $ifNull: ['$views', 0] } }
            }
        }
    ]).toArray();
    const stats = { total: 0, published: 0, draft: 0, archived: 0, views: 0 };

    for (const group of grouped) {
        const status = VALID_STATUSES.has(group._id) ? group._id : 'published';
        stats.total += group.count;
        stats.views += group.views;
        stats[status] += group.count;
    }

    return stats;
}

async function getCategories(req, res) {
    try {
        const categories = await Blog.aggregate([
            {
                $match: {
                    category: { $type: 'string', $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$category',
                    slug: { $first: '$categorySlug' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    slug: { $ifNull: ['$slug', '$_id'] }
                }
            }
        ]).toArray();

        res.json(categories);
    } catch (error) {
        console.error('Lỗi lấy danh mục bài viết:', error);
        res.status(500).json({ message: 'Không thể lấy danh mục bài viết.' });
    }
}

async function getAuthors(req, res) {
    try {
        const authors = await Blog.aggregate([
            {
                $match: {
                    author: { $type: 'string', $ne: '' }
                }
            },
            { $group: { _id: '$author' } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, name: '$_id' } }
        ]).toArray();

        res.json(authors.map(author => author.name));
    } catch (error) {
        console.error('Lỗi lấy tác giả bài viết:', error);
        res.status(500).json({ message: 'Không thể lấy danh sách tác giả.' });
    }
}

function makeDocument(body, existing = {}) {
    const title = String(body.title || '').trim();
    const excerpt = String(body.excerpt || '').trim();
    const category = String(body.category || '').trim();
    const author = String(body.author || '').trim();
    const content = String(body.content || '').trim();
    const status = String(body.status || existing.status || 'draft');
    const image = String(body.image || existing.image || '/assets/images/bl1.jpg').trim();
    const imageData = typeof body.imageData === 'string' ? body.imageData : '';
    const imageMimeType = String(body.imageMimeType || '');

    if (!title || title.length > 180) {
        return { error: 'Tiêu đề bài viết bắt buộc và không vượt quá 180 ký tự.' };
    }
    if (!excerpt || excerpt.length > 500) {
        return { error: 'Mô tả ngắn bắt buộc và không vượt quá 500 ký tự.' };
    }
    if (!category || category.length > 80) {
        return { error: 'Vui lòng nhập danh mục hợp lệ.' };
    }
    if (!author || author.length > 100) {
        return { error: 'Vui lòng nhập tên tác giả hợp lệ.' };
    }
    if (!content || content.length > 3_500_000) {
        return { error: 'Nội dung bài viết bắt buộc và tối đa 3.500.000 ký tự.' };
    }
    if (!VALID_STATUSES.has(status)) {
        return { error: 'Trạng thái bài viết không hợp lệ.' };
    }
    if (!image || image.length > 2048) {
        return { error: 'Đường dẫn hình ảnh không hợp lệ.' };
    }
    if (imageData && (
        imageData.length > 5_000_000
        || !/^image\/(jpeg|png|webp|gif)$/.test(imageMimeType)
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)
    )) {
        return { error: 'Ảnh bìa không hợp lệ hoặc vượt quá dung lượng cho phép.' };
    }

    const publishedAt = body.publishedAt
        ? new Date(body.publishedAt)
        : status === 'published' ? existing.publishedAt || new Date() : existing.publishedAt || null;

    if (publishedAt && Number.isNaN(publishedAt.getTime())) {
        return { error: 'Ngày đăng không hợp lệ.' };
    }

    const slug = slugify(String(body.slug || title));
    const readTime = `${Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length / 200))} phút`;
    const now = new Date();
    const fields = {
        slug,
        title,
        excerpt,
        content,
        author,
        authorRole: String(body.authorRole || existing.authorRole || 'Biên tập viên Floralia').trim(),
        category,
        categorySlug: slugify(String(body.categorySlug || category)),
        image,
        imageAlt: String(body.imageAlt ?? existing.imageAlt ?? '').trim().slice(0, 200),
        featured: body.featured === true || body.featured === 'true',
        status,
        publishedAt,
        date: publishedAt
            ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(publishedAt)
            : '',
        readTime,
        tags: Array.isArray(body.tags)
            ? body.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 20)
            : Array.isArray(existing.tags) ? existing.tags : [],
        metaTitle: String(body.metaTitle || title).trim().slice(0, 180),
        metaDescription: String(body.metaDescription || excerpt).trim().slice(0, 500),
        views: existing.views || 0,
        createdAt: existing.createdAt || now,
        updatedAt: now
    };

    if (imageData) {
        fields.imageData = imageData;
        fields.imageMimeType = imageMimeType;
        fields.imageFileName = String(body.imageFileName || '').slice(0, 200);
    } else if (existing.imageData && image === existing.image && body.clearImageData !== true) {
        fields.imageData = existing.imageData;
        fields.imageMimeType = existing.imageMimeType || null;
        fields.imageFileName = existing.imageFileName || null;
    }

    return { fields };
}

async function getAdminBlogs(req, res) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const status = String(req.query.status || 'all');
        const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        const filter = buildFilter(status, query);
        const [data, total, stats] = await Promise.all([
            Blog.find(filter)
                .project({
                    title: 1,
                    slug: 1,
                    category: 1,
                    publishedAt: 1,
                    date: 1,
                    status: 1,
                    views: 1
                })
                .sort({ publishedAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            Blog.countDocuments(filter),
            getStats()
        ]);

        res.json({
            data: data.map(blog => ({ ...blog, status: resolveStatus(blog) })),
            total,
            page,
            limit,
            stats
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách bài viết quản trị:', error);
        res.status(500).json({ message: 'Không thể lấy danh sách bài viết.' });
    }
}

async function getAdminBlog(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Mã bài viết không hợp lệ.' });
        }

        const blog = await Blog.findOne({ _id: new ObjectId(req.params.id) });
        if (!blog) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }

        res.json({ ...blog, status: resolveStatus(blog) });
    } catch (error) {
        console.error('Lỗi lấy chi tiết bài viết quản trị:', error);
        res.status(500).json({ message: 'Không thể lấy chi tiết bài viết.' });
    }
}

async function createBlog(req, res) {
    try {
        const result = makeDocument(req.body);
        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        let candidateSlug = result.fields.slug;
        let suffix = 1;
        while (await Blog.findOne({ slug: candidateSlug })) {
            candidateSlug = `${result.fields.slug}-${suffix++}`;
        }
        result.fields.slug = candidateSlug;

        const inserted = await Blog.insertOne(result.fields);
        res.status(201).json({
            ...result.fields,
            _id: inserted.insertedId
        });
    } catch (error) {
        console.error('Lỗi tạo bài viết:', error);
        res.status(500).json({ message: 'Không thể tạo bài viết.' });
    }
}

async function updateBlog(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Mã bài viết không hợp lệ.' });
        }

        const filter = { _id: new ObjectId(req.params.id) };
        const existing = await Blog.findOne(filter);
        if (!existing) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }

        const result = makeDocument(req.body, existing);
        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const duplicate = await Blog.findOne({
            slug: result.fields.slug,
            _id: { $ne: existing._id }
        });
        if (duplicate) {
            return res.status(409).json({ message: 'Đường dẫn bài viết đã được sử dụng.' });
        }

        const update = { $set: result.fields };
        if (existing.imageData && (result.fields.image !== existing.image || req.body.clearImageData === true)) {
            update.$unset = { imageData: '', imageMimeType: '', imageFileName: '' };
        }
        await Blog.updateOne(filter, update);
        const response = { ...existing, ...result.fields, _id: existing._id };
        if (update.$unset) {
            delete response.imageData;
            delete response.imageMimeType;
            delete response.imageFileName;
        }
        res.json(response);
    } catch (error) {
        console.error('Lỗi cập nhật bài viết:', error);
        res.status(500).json({ message: 'Không thể cập nhật bài viết.' });
    }
}

async function deleteBlog(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Mã bài viết không hợp lệ.' });
        }

        const result = await Blog.deleteOne({ _id: new ObjectId(req.params.id) });
        if (!result.deletedCount) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Lỗi xóa bài viết:', error);
        res.status(500).json({ message: 'Không thể xóa bài viết.' });
    }
}

module.exports = {
    getAdminBlogs,
    getCategories,
    getAuthors,
    getAdminBlog,
    createBlog,
    updateBlog,
    deleteBlog
};
