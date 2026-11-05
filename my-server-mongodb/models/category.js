const { ObjectId } = require('mongodb');

let categoriesCollection;
let seededPromise = null;

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

const DEFAULT_CATEGORIES = [
    { code: 'DM01', name: 'Trà thảo mộc', level: 'main', parentCode: '', parentName: '', visible: true, order: 1 },
    { code: 'DM01-01', name: 'Thanh lọc – Mát gan', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true, order: 2 },
    { code: 'DM01-02', name: 'Dưỡng nhan – Cân bằng nội tiết', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true, order: 3 },
    { code: 'DM01-03', name: 'Giảm stress – Ngủ ngon', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true, order: 4 },
    { code: 'DM01-04', name: 'Thanh tâm – Dưỡng thần', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true, order: 5 },
    { code: 'DM01-05', name: 'Bổ khí huyết – Dưỡng sinh', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true, order: 6 },
    { code: 'DM02', name: 'Trà thảo mộc mix', level: 'main', parentCode: '', parentName: '', visible: true, order: 7 },
    { code: 'DM02-01', name: 'Thanh lọc – Mát gan', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true, order: 8 },
    { code: 'DM02-02', name: 'Dưỡng nhan – Cân bằng nội tiết', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true, order: 9 },
    { code: 'DM02-03', name: 'Giảm stress – Ngủ ngon', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true, order: 10 },
    { code: 'DM02-04', name: 'Thanh tâm – Dưỡng thần', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true, order: 11 },
    { code: 'DM02-05', name: 'Bổ khí huyết – Dưỡng sinh', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true, order: 12 },
    { code: 'DM03', name: 'Ấm trà', level: 'main', parentCode: '', parentName: '', visible: true, order: 13 },
    { code: 'DM04', name: 'Đồ uống kèm trà', level: 'main', parentCode: '', parentName: '', visible: true, order: 14 },
    { code: 'DM05', name: 'Set quà tặng', level: 'main', parentCode: '', parentName: '', visible: true, order: 15 }
];

function setCollection(collection) {
    categoriesCollection = collection;
}

async function ensureSeeded() {
    if (!categoriesCollection) return;
    if (!seededPromise) {
        seededPromise = (async () => {
            try {
                const count = await categoriesCollection.countDocuments({});
                if (count === 0) {
                    const now = new Date();
                    const docs = DEFAULT_CATEGORIES.map(item => ({
                        ...item,
                        slug: slugify(item.name),
                        createdAt: now,
                        updatedAt: now
                    }));
                    await categoriesCollection.insertMany(docs);
                }
            } catch (error) {
                console.error('Lỗi khởi tạo danh mục mặc định:', error);
            }
        })();
    }
    await seededPromise;
}

async function getAll() {
    if (!categoriesCollection) return [];
    await ensureSeeded();
    const items = await categoriesCollection.find({}).toArray();
    return items.sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true }));
}

async function getById(id) {
    if (!categoriesCollection || !ObjectId.isValid(id)) return null;
    await ensureSeeded();
    return categoriesCollection.findOne({ _id: new ObjectId(id) });
}

async function getByCode(code, exceptId = null) {
    if (!categoriesCollection) return null;
    await ensureSeeded();
    const filter = { code: String(code || '').trim().toUpperCase() };
    if (exceptId && ObjectId.isValid(exceptId)) {
        filter._id = { $ne: new ObjectId(exceptId) };
    }
    return categoriesCollection.findOne(filter);
}

async function create(category) {
    if (!categoriesCollection) throw new Error('Category collection is not initialized');
    await ensureSeeded();
    const result = await categoriesCollection.insertOne(category);
    return { _id: result.insertedId, ...category };
}

async function update(id, category) {
    if (!categoriesCollection || !ObjectId.isValid(id)) return null;
    await ensureSeeded();
    const result = await categoriesCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: category },
        { returnDocument: 'after' }
    );
    return result?.value ?? result;
}

async function updateMany(filter, updateDoc) {
    if (!categoriesCollection) return;
    await categoriesCollection.updateMany(filter, updateDoc);
}

async function remove(id) {
    if (!categoriesCollection || !ObjectId.isValid(id)) return { deletedCount: 0 };
    await ensureSeeded();
    return categoriesCollection.deleteOne({ _id: new ObjectId(id) });
}

async function removeMany(filter) {
    if (!categoriesCollection) return;
    return categoriesCollection.deleteMany(filter);
}

module.exports = {
    setCollection,
    getAll,
    getById,
    getByCode,
    create,
    update,
    updateMany,
    remove,
    removeMany,
    slugify
};

