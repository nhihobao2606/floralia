const { ObjectId } = require('mongodb');
const Category = require('../models/category');
const AdminProduct = require('../models/adminProduct');

const { slugify } = Category;

function extractBenefitTokens(name) {
    const full = slugify(name);
    const parts = String(name || '')
        .split(/[–—-]/)
        .map(part => slugify(part))
        .filter(Boolean);
    return Array.from(new Set([full, ...parts].filter(Boolean)));
}

function countProductsForCategory(category, products) {
    if (!Array.isArray(products) || !products.length) return 0;
    const catSlug = slugify(category.name);

    if (category.level === 'main') {
        return products.filter(product => {
            const pCatSlug = slugify(product.categorySlug || product.category);
            const pCatNameSlug = slugify(product.category);
            return pCatSlug === catSlug || pCatNameSlug === catSlug;
        }).length;
    }

    const parentSlug = slugify(category.parentName);
    const tokens = extractBenefitTokens(category.name);
    return products.filter(product => {
        if (parentSlug) {
            const pCatSlug = slugify(product.categorySlug || product.category);
            const pCatNameSlug = slugify(product.category);
            if (pCatSlug !== parentSlug && pCatNameSlug !== parentSlug) {
                return false;
            }
        }
        const subSlug = slugify(product.subCategory);
        if (subSlug && (subSlug === catSlug || tokens.includes(subSlug))) {
            return true;
        }
        const usageSlugs = Array.isArray(product.usage) ? product.usage.map(slugify) : [];
        const benefitSlugs = Array.isArray(product.benefits) ? product.benefits.map(slugify) : [];
        const allProductTokens = [...usageSlugs, ...benefitSlugs];
        return tokens.some(token => allProductTokens.includes(token));
    }).length;
}

function sortCategoriesHierarchically(categories) {
    const mains = categories
        .filter(c => c.level === 'main')
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true }));
    const subs = categories
        .filter(c => c.level !== 'main')
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true }));

    const result = [];
    const usedSubIds = new Set();

    for (const main of mains) {
        result.push(main);
        const children = subs.filter(sub =>
            (sub.parentCode && sub.parentCode === main.code) ||
            (sub.parentName && slugify(sub.parentName) === slugify(main.name))
        );
        for (const child of children) {
            result.push(child);
            usedSubIds.add(String(child._id));
        }
    }

    for (const sub of subs) {
        if (!usedSubIds.has(String(sub._id))) {
            result.push(sub);
        }
    }
    return result;
}

async function getAdminCategories(req, res) {
    try {
        const [rawCategories, allProducts] = await Promise.all([
            Category.getAll(),
            AdminProduct.getAll()
        ]);

        const enriched = sortCategoriesHierarchically(rawCategories).map(cat => ({
            ...cat,
            slug: cat.slug || slugify(cat.name),
            visible: cat.visible !== false,
            productCount: countProductsForCategory(cat, allProducts)
        }));

        const mainList = enriched.filter(cat => cat.level === 'main');
        const subList = enriched.filter(cat => cat.level !== 'main');
        const uniqueSubCount = new Set(subList.map(cat => slugify(cat.name))).size;
        const hiddenCount = enriched.filter(cat => !cat.visible).length;

        const stats = {
            total: enriched.length,
            main: mainList.length,
            sub: uniqueSubCount,
            hidden: hiddenCount
        };

        res.json({
            data: enriched,
            total: enriched.length,
            stats,
            mainCategories: mainList.map(cat => ({ _id: String(cat._id), code: cat.code, name: cat.name, slug: cat.slug }))
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể tải danh sách danh mục.' });
    }
}

async function getAdminCategory(req, res) {
    try {
        const category = await Category.getById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        }
        const allProducts = await AdminProduct.getAll();
        res.json({
            ...category,
            slug: category.slug || slugify(category.name),
            visible: category.visible !== false,
            productCount: countProductsForCategory(category, allProducts)
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể tải thông tin danh mục.' });
    }
}

async function createCategory(req, res) {
    try {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        const code = String(body.code || '').trim().toUpperCase();
        const parentName = String(body.parentName || '').trim();

        if (!name) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục.' });
        }
        if (!code) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập mã danh mục.' });
        }
        if (await Category.getByCode(code)) {
            return res.status(409).json({ success: false, message: 'Mã danh mục đã tồn tại.' });
        }

        const allCategories = await Category.getAll();
        let parentCode = '';
        let resolvedParentName = '';
        if (parentName) {
            const parentCat = allCategories.find(
                cat => cat.level === 'main' && (cat.name === parentName || cat.code === body.parentCode)
            );
            parentCode = parentCat ? parentCat.code : String(body.parentCode || '').trim().toUpperCase();
            resolvedParentName = parentCat ? parentCat.name : parentName;
        }

        const now = new Date();
        const doc = {
            code,
            name,
            slug: slugify(name),
            level: resolvedParentName ? 'sub' : 'main',
            parentCode: resolvedParentName ? parentCode : '',
            parentName: resolvedParentName,
            visible: body.visible !== false,
            createdAt: now,
            updatedAt: now
        };

        const created = await Category.create(doc);
        const allProducts = await AdminProduct.getAll();
        AdminProduct.notifyProductChanged('categories', created._id);
        res.status(201).json({
            ...created,
            productCount: countProductsForCategory(created, allProducts)
        });
    } catch (error) {
        console.error('Lỗi tạo danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể tạo danh mục.' });
    }
}

async function updateCategory(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
        }
        const existing = await Category.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        }

        const body = req.body || {};
        const name = String(body.name || '').trim();
        const code = String(body.code || '').trim().toUpperCase();
        const parentName = String(body.parentName || '').trim();

        if (!name) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục.' });
        }
        if (!code) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập mã danh mục.' });
        }
        if (await Category.getByCode(code, req.params.id)) {
            return res.status(409).json({ success: false, message: 'Mã danh mục đã tồn tại.' });
        }

        const allCategories = await Category.getAll();
        let parentCode = '';
        let resolvedParentName = '';
        if (parentName) {
            const parentCat = allCategories.find(
                cat => cat.level === 'main' && String(cat._id) !== String(existing._id) && (cat.name === parentName || cat.code === body.parentCode)
            );
            parentCode = parentCat ? parentCat.code : String(body.parentCode || '').trim().toUpperCase();
            resolvedParentName = parentCat ? parentCat.name : parentName;
        }

        const updateDoc = {
            code,
            name,
            slug: slugify(name),
            level: resolvedParentName ? 'sub' : 'main',
            parentCode: resolvedParentName ? parentCode : '',
            parentName: resolvedParentName,
            visible: body.visible !== false,
            updatedAt: new Date()
        };

        const updated = await Category.update(req.params.id, updateDoc);
        if (existing.level === 'main' && (existing.name !== name || existing.code !== code)) {
            await Category.updateMany(
                { parentCode: existing.code },
                { $set: { parentCode: code, parentName: name, updatedAt: new Date() } }
            );
            if (existing.name !== name) {
                await AdminProduct.updateMany(
                    { category: existing.name },
                    { $set: { category: name, categorySlug: slugify(name), updatedAt: new Date() } }
                );
            }
        }

        const allProducts = await AdminProduct.getAll();
        AdminProduct.notifyProductChanged('categories', req.params.id);
        res.json({
            ...updated,
            productCount: countProductsForCategory(updated, allProducts)
        });
    } catch (error) {
        console.error('Lỗi cập nhật danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật danh mục.' });
    }
}

async function toggleCategoryVisibility(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
        }
        const existing = await Category.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        }
        const visible = req.body?.visible !== undefined ? Boolean(req.body.visible) : !(existing.visible !== false);
        const updated = await Category.update(req.params.id, { visible, updatedAt: new Date() });
        if (existing.level === 'main') {
            await Category.updateMany(
                { parentCode: existing.code },
                { $set: { visible, updatedAt: new Date() } }
            );
        }
        const allProducts = await AdminProduct.getAll();
        AdminProduct.notifyProductChanged('categories', req.params.id);
        res.json({
            ...updated,
            productCount: countProductsForCategory(updated, allProducts)
        });
    } catch (error) {
        console.error('Lỗi cập nhật hiển thị danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái hiển thị.' });
    }
}

async function deleteCategory(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
        }
        const existing = await Category.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        }
        const result = await Category.remove(req.params.id);
        if (!result.deletedCount) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        }
        if (existing.level === 'main') {
            await Category.removeMany({ parentCode: existing.code });
            await AdminProduct.updateMany(
                { category: existing.name },
                { $set: { category: 'Chưa phân loại', categorySlug: 'chua-phan-loai', updatedAt: new Date() } }
            );
        }
        AdminProduct.notifyProductChanged('categories', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Lỗi xóa danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa danh mục.' });
    }
}

async function getPublicCategories(req, res) {
    try {
        const rawCategories = await Category.getAll();
        const sorted = sortCategoriesHierarchically(rawCategories);

        const visibleMain = sorted
            .filter(cat => cat.level === 'main' && cat.visible !== false)
            .map(cat => ({
                _id: String(cat._id),
                code: cat.code,
                name: cat.name,
                slug: cat.slug || slugify(cat.name)
            }));

        const visibleMainCodes = new Set(visibleMain.map(cat => cat.code));
        const visibleMainNames = new Set(visibleMain.map(cat => slugify(cat.name)));

        const visibleSubs = sorted.filter(cat => {
            if (cat.level === 'main' || cat.visible === false) return false;
            if (cat.parentCode && visibleMainCodes.has(cat.parentCode)) return true;
            if (cat.parentName && visibleMainNames.has(slugify(cat.parentName))) return true;
            return !cat.parentCode && !cat.parentName;
        });

        const benefitsMap = new Map();
        for (const sub of visibleSubs) {
            const key = slugify(sub.name);
            if (!key) continue;
            const tokens = extractBenefitTokens(sub.name);
            const parentSlug = slugify(sub.parentName);
            if (!benefitsMap.has(key)) {
                benefitsMap.set(key, {
                    label: sub.name,
                    slug: key,
                    values: tokens.filter(t => t !== key).length ? tokens.filter(t => t !== key) : [key],
                    parentSlugs: parentSlug ? [parentSlug] : []
                });
            } else {
                const existingBenefit = benefitsMap.get(key);
                if (parentSlug && !existingBenefit.parentSlugs.includes(parentSlug)) {
                    existingBenefit.parentSlugs.push(parentSlug);
                }
            }
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({
            mainCategories: visibleMain,
            benefits: Array.from(benefitsMap.values()),
            allCategories: sorted.map(cat => ({
                _id: String(cat._id),
                code: cat.code,
                name: cat.name,
                slug: cat.slug || slugify(cat.name),
                level: cat.level,
                parentCode: cat.parentCode || '',
                parentName: cat.parentName || '',
                visible: cat.visible !== false
            }))
        });
    } catch (error) {
        console.error('Lỗi lấy danh mục công khai:', error);
        res.status(500).json({ message: 'Không thể tải danh mục.' });
    }
}

module.exports = {
    getAdminCategories,
    getAdminCategory,
    createCategory,
    updateCategory,
    toggleCategoryVisibility,
    deleteCategory,
    getPublicCategories
};
