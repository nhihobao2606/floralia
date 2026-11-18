const Product = require('../models/product');
const Order = require('../models/order');
const { EventEmitter } = require('events');

const SEGMENTS = [
    { id: 'new', name: 'Khách hàng mới', description: 'Chưa có đơn hàng hoàn tất.' },
    { id: 'loyal', name: 'Khách hàng thân thiết', description: 'Có từ 3 đơn hàng hoàn tất.' },
    { id: 'high-value', name: 'Khách hàng giá trị cao', description: 'Tổng chi tiêu từ 2.000.000₫.' },
    { id: 'returning', name: 'Khách hàng quay lại', description: 'Đã mua hàng và chưa thuộc nhóm khác.' },
    { id: 'at-risk', name: 'Khách hàng cần quan tâm', description: 'Đơn hoàn tất gần nhất đã hơn 90 ngày.' }
];
const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'refunded', 'refund_approved']);
const recommendationEvents = new EventEmitter();
recommendationEvents.setMaxListeners(500);
let recommendationSnapshot = null;
let recommendationSnapshotPromise = null;
let recommendationSnapshotVersion = 0;
let productViewsCollection;

function getViewerKeys(user, visitorId) {
    // Keep browsing histories isolated between accounts on a shared browser.
    // Anonymous visitors use a browser ID until they sign in.
    if (user?._id) return [`user:${String(user._id)}`];
    const normalizedVisitorId = String(visitorId || '').trim();
    return /^[a-zA-Z0-9-]{16,80}$/.test(normalizedVisitorId)
        ? [`visitor:${normalizedVisitorId}`]
        : [];
}

function getViewerKey(user, visitorId) {
    return getViewerKeys(user, visitorId)[0] || '';
}

async function recordProductView(user, visitorId, sku) {
    const viewerKey = getViewerKey(user, visitorId);
    const requestedSku = String(sku || '').trim();
    if (!viewerKey || !requestedSku || !productViewsCollection) return false;
    const products = await Product.getAll();
    const matchedProduct = products.find(product =>
        String(product.sku) === requestedSku || (product.variants || []).some(variant => String(variant.sku) === requestedSku)
    );
    if (!matchedProduct) return false;
    const normalizedSku = String(matchedProduct.sku);
    const now = new Date();
    await productViewsCollection.updateOne(
        { viewerKey, sku: normalizedSku },
        { $set: { viewerKey, sku: normalizedSku, lastViewedAt: now }, $setOnInsert: { createdAt: now }, $inc: { viewCount: 1 } },
        { upsert: true }
    );
    recommendationEvents.emit('updated', { version: Date.now(), action: 'product-view' });
    return true;
}

function notifyOrdersChanged() {
    recommendationSnapshotVersion++;
    recommendationSnapshot = null;
    recommendationEvents.emit('updated', { version: Date.now() });
}

async function getRecommendationSnapshot() {
    if (recommendationSnapshot && recommendationSnapshot.expiresAt > Date.now()) return recommendationSnapshot;
    if (recommendationSnapshotPromise) return recommendationSnapshotPromise;
    const requestedVersion = recommendationSnapshotVersion;
    recommendationSnapshotPromise = Promise.all([
        Order.getRecommendationHistory(),
        Product.getAll()
    ]).then(([orders, products]) => {
        const model = trainRecommendationModel(orders, products);
        const snapshot = { orders, products, model, expiresAt: Date.now() + 15000 };
        if (requestedVersion === recommendationSnapshotVersion) recommendationSnapshot = snapshot;
        return snapshot;
    }).finally(() => { recommendationSnapshotPromise = null; });
    return recommendationSnapshotPromise;
}

function getProductCategories(value) {
    if (Array.isArray(value)) return value.flatMap(getProductCategories);
    if (value && typeof value === 'object') return getProductCategories(value.slug || value.code || value.name || '');
    const normalized = String(value || '').trim().toLowerCase();
    return normalized ? [normalized] : [];
}

function normalizeFeature(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getProductFeatures(product) {
    const stopWords = new Set(['tra', 'tea', 'thao', 'moc', 'va', 'voi', 'cho', 'cua', 'tu', 'hop', 'goi']);
    const descriptiveText = [product?.name, product?.title, product?.flavorNote, product?.subCategory]
        .map(normalizeFeature).join('-');
    const descriptiveTerms = descriptiveText.split('-').filter(term => term.length > 2 && !stopWords.has(term));
    const tags = [...(Array.isArray(product?.tags) ? product.tags : []), ...(Array.isArray(product?.benefits) ? product.benefits : []), ...descriptiveTerms]
        .map(normalizeFeature).filter(Boolean);
    return {
        categories: new Set(getProductCategories([product?.categorySlug, product?.category]).map(normalizeFeature)),
        subCategories: new Set([normalizeFeature(product?.subCategory)].filter(Boolean)),
        tags: new Set(tags),
        price: Number(product?.price || product?.minPrice || 0)
    };
}

function calculateContentSimilarity(left, right) {
    if (!left || !right) return 0;
    const overlap = [...left.tags].filter(tag => right.tags.has(tag)).length;
    const union = new Set([...left.tags, ...right.tags]).size;
    const tagSimilarity = union ? overlap / union : 0;
    const categorySimilarity = [...left.categories].some(category => right.categories.has(category)) ? 1 : 0;
    const subCategorySimilarity = [...left.subCategories].some(category => right.subCategories.has(category)) ? 1 : 0;
    const priceSimilarity = left.price > 0 && right.price > 0 ? Math.exp(-Math.abs(Math.log(left.price / right.price))) : 0;
    return tagSimilarity * 0.52 + categorySimilarity * 0.26 + subCategorySimilarity * 0.14 + priceSimilarity * 0.08;
}

function userSegment(summary, now = Date.now()) {
    if (!summary.orderCount) return 'new';
    if (summary.lastOrderAt && now - new Date(summary.lastOrderAt).getTime() > 90 * 86400000) return 'at-risk';
    if (summary.totalSpent >= 2000000) return 'high-value';
    if (summary.orderCount >= 3) return 'loyal';
    return 'returning';
}

function isCompletedOrder(order) {
    return !INACTIVE_STATUSES.has(String(order.status || '').toLowerCase()) && !order.isDemo;
}

function trainRecommendationModel(orders, products) {
    const productSkus = new Set(products.map(product => String(product.sku || '')).filter(Boolean));
    const support = new Map();
    const pairCounts = new Map();
    const globalPopularity = new Map();
    const owners = new Map();
    const now = Date.now();

    for (const order of orders) {
        if (!isCompletedOrder(order)) continue;
        const owner = order.userId ? String(order.userId) : String(order.receiver?.email || '').trim().toLowerCase();
        const date = new Date(order.createdAt || 0).getTime();
        const ageDays = Number.isFinite(date) && date > 0 ? Math.max(0, (now - date) / 86400000) : 365;
        const recency = Math.exp(-ageDays / 90);
        const quantities = new Map();
        for (const item of order.items || []) {
            const sku = String(item.sku || '');
            if (!sku || !productSkus.has(sku)) continue;
            quantities.set(sku, Math.min(5, (quantities.get(sku) || 0) + Math.max(1, Number(item.quantity) || 1)));
            globalPopularity.set(sku, (globalPopularity.get(sku) || 0) + recency * Math.min(5, Math.max(1, Number(item.quantity) || 1)));
        }
        const skus = [...quantities.keys()];
        for (const sku of skus) support.set(sku, (support.get(sku) || 0) + recency);
        for (let i = 0; i < skus.length; i++) {
            for (let j = i + 1; j < skus.length; j++) {
                const key = `${skus[i]}\u0000${skus[j]}`;
                pairCounts.set(key, (pairCounts.get(key) || 0) + recency * Math.sqrt(quantities.get(skus[i]) * quantities.get(skus[j])));
            }
        }
        if (owner) {
            const customer = owners.get(owner) || { orders: [], skuCounts: new Map() };
            customer.orders.push(order);
            for (const [sku, quantity] of quantities) customer.skuCounts.set(sku, (customer.skuCounts.get(sku) || 0) + recency * quantity);
            owners.set(owner, customer);
        }
    }

    const neighbors = new Map();
    for (const [pair, count] of pairCounts) {
        const [a, b] = pair.split('\u0000');
        const similarity = count / Math.sqrt((support.get(a) || 0) * (support.get(b) || 0)) * (count / (count + 2));
        for (const [source, target] of [[a, b], [b, a]]) {
            const list = neighbors.get(source) || [];
            list.push({ sku: target, score: similarity });
            neighbors.set(source, list);
        }
    }
    for (const [sku, list] of neighbors) neighbors.set(sku, list.sort((a, b) => b.score - a.score).slice(0, 40));

    const segmentPopularity = new Map();
    for (const customer of owners.values()) {
        const lastOrderAt = customer.orders.reduce((latest, order) => {
            const date = new Date(order.createdAt || 0);
            return !latest || date > latest ? date : latest;
        }, null);
        const segment = userSegment({
            orderCount: customer.orders.length,
            totalSpent: customer.orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
            lastOrderAt
        });
        if (!segmentPopularity.has(segment)) segmentPopularity.set(segment, new Map());
        const counts = segmentPopularity.get(segment);
        for (const [sku, value] of customer.skuCounts) counts.set(sku, (counts.get(sku) || 0) + value);
    }
    return { neighbors, segmentPopularity, globalPopularity };
}

async function buildOverview() {
    const baseOrderFilter = { isDemo: { $ne: true }, status: { $nin: [...INACTIVE_STATUSES] } };
    const [users, orderSummaries, legacyOrderSummaries, products] = await Promise.all([
        usersCollection.find({ role: { $ne: 'admin' } }, { projection: { _id: 1, fullName: 1, email: 1 }, maxTimeMS: 10000 }).toArray(),
        ordersCollection.aggregate([
            { $match: { ...baseOrderFilter, userId: { $exists: true, $nin: ['', null] } } },
            { $group: {
                _id: { $toString: '$userId' },
                orderCount: { $sum: 1 },
                totalSpent: { $sum: { $convert: { input: '$total', to: 'double', onError: 0, onNull: 0 } } },
                lastOrderAt: { $max: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } }
            } }
        ], { maxTimeMS: 10000 }).toArray(),
        ordersCollection.aggregate([
            { $match: { ...baseOrderFilter, $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }], 'receiver.email': { $type: 'string' } } },
            { $group: {
                _id: { $toLower: { $trim: { input: '$receiver.email' } } },
                orderCount: { $sum: 1 },
                totalSpent: { $sum: { $convert: { input: '$total', to: 'double', onError: 0, onNull: 0 } } },
                lastOrderAt: { $max: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } }
            } }
        ], { maxTimeMS: 10000 }).toArray(),
        productsCollection.find({ isActive: { $ne: false } }, { projection: { sku: 1, name: 1, title: 1, price: 1, thumbnail: 1, category: 1 }, maxTimeMS: 10000 }).toArray()
    ]);
    const segments = SEGMENTS.map(segment => ({ ...segment, customerCount: 0, customers: [], productSkus: [] }));
    const summaryByUserId = new Map(orderSummaries.map(summary => [String(summary._id), summary]));
    const summaryByEmail = new Map(legacyOrderSummaries.map(summary => [summary._id, summary]));
    for (const user of users) {
        const summary = summaryByUserId.get(String(user._id)) ||
            summaryByEmail.get(String(user.email || '').trim().toLowerCase()) ||
            { orderCount: 0, totalSpent: 0, lastOrderAt: null };
        const segmentId = userSegment(summary);
        const segment = segments.find(item => item.id === segmentId);
        segment.customerCount++;
        if (segment.customers.length < 8) {
        segment.customers.push({ id: String(user._id), fullName: user.fullName || 'Khách hàng', email: user.email, orderCount: summary.orderCount, totalSpent: summary.totalSpent, lastOrderAt: summary.lastOrderAt });
        }
    }
    return { segments, products: products.filter(product => product.sku) };
}

let settingsCollection;
let usersCollection;
let ordersCollection;
let productsCollection;
function setCollections(settings, users, orders, products, productViews) {
    settingsCollection = settings;
    usersCollection = users;
    ordersCollection = orders;
    productsCollection = products;
    productViewsCollection = productViews;
}

async function getAdminData() {
    const overview = await buildOverview();
    const saved = settingsCollection ? await settingsCollection.findOne({ _id: 'product-recommendations' }) : null;
    for (const segment of overview.segments) segment.productSkus = saved?.segments?.[segment.id]?.productSkus || [];
    return { segments: overview.segments, products: overview.products.map(({ sku, name, title, price, thumbnail, category }) => ({ sku, name: name || title || sku, price: Number(price) || 0, thumbnail: thumbnail || '', category: category || '' })) };
}

async function saveSegment(segmentId, productSkus) {
    if (!SEGMENTS.some(segment => segment.id === segmentId)) throw new Error('Phân khúc không hợp lệ.');
    const products = await Product.getAll();
    const available = new Set(products.map(product => product.sku));
    const normalized = [...new Set((Array.isArray(productSkus) ? productSkus : []).map(String).filter(sku => available.has(sku)))].slice(0, 12);
    await settingsCollection.updateOne(
        { _id: 'product-recommendations' },
        { $set: { [`segments.${segmentId}`]: { productSkus: normalized, updatedAt: new Date() }, updatedAt: new Date() } },
        { upsert: true }
    );
    notifyOrdersChanged();
    return normalized;
}

async function getForCustomer(user, visitorId) {
    const viewerKeys = getViewerKeys(user, visitorId);
    const [snapshot, saved] = await Promise.all([
        getRecommendationSnapshot(),
        settingsCollection ? settingsCollection.findOne({ _id: 'product-recommendations' }) : Promise.resolve(null)
    ]);
    const { orders, products, model } = snapshot;
    const now = Date.now();
    const userId = user ? String(user._id) : '';
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const customerOrders = user ? orders.filter(order =>
        (String(order.userId || '') === userId || (!order.userId && String(order.receiver?.email || '').trim().toLowerCase() === userEmail)) &&
        isCompletedOrder(order)
    ) : [];
    const viewHistory = viewerKeys.length && productViewsCollection
        ? await productViewsCollection.find({ viewerKey: { $in: viewerKeys } }).sort({ lastViewedAt: -1 }).limit(100).toArray()
        : [];
    const summary = {
        orderCount: customerOrders.length,
        totalSpent: customerOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
        lastOrderAt: customerOrders.reduce((latest, order) => {
            const createdAt = new Date(order.createdAt || 0);
            return !latest || createdAt > latest ? createdAt : latest;
        }, null)
    };
    // Anonymous storefront visitors are treated as new customers so the manually
    // curated recommendations for that segment are visible before sign-in.
    const segmentId = user ? userSegment(summary, now) : 'new';
    const productBySku = new Map(products.map(product => [String(product.sku), product]));
    const purchasedSkus = new Set(customerOrders.flatMap(order => (order.items || []).map(item => String(item.sku || '')).filter(Boolean)));
    const profile = new Map();
    const categoryAffinity = new Map();
    const viewedSkus = new Set();
    const viewedProducts = [];
    for (const order of customerOrders) {
        const ageDays = Math.max(0, (now - new Date(order.createdAt || 0).getTime()) / 86400000);
        const recency = Number.isFinite(ageDays) ? Math.exp(-ageDays / 120) : 0.2;
        for (const item of order.items || []) {
            const sku = String(item.sku || '');
            if (!sku) continue;
            profile.set(sku, (profile.get(sku) || 0) + recency * Math.min(5, Math.max(1, Number(item.quantity) || 1)));
            const product = productBySku.get(sku);
            for (const category of getProductCategories(item.category || item.categorySlug || product?.category)) {
                categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + recency);
            }
        }
    }

    for (const view of viewHistory) {
        const sku = String(view.sku || '');
        if (!sku || !productBySku.has(sku)) continue;
        viewedSkus.add(sku);
        const ageDays = Math.max(0, (now - new Date(view.lastViewedAt || view.createdAt || 0).getTime()) / 86400000);
        const recency = Number.isFinite(ageDays) ? Math.exp(-ageDays / 14) : 0.05;
        const viewWeight = Math.log1p(Math.max(1, Number(view.viewCount) || 1)) * recency;
        profile.set(sku, (profile.get(sku) || 0) + viewWeight);
        const viewedProduct = productBySku.get(sku);
        viewedProducts.push({ sku, features: getProductFeatures(viewedProduct), weight: viewWeight });
        for (const category of getProductCategories([viewedProduct?.categorySlug, viewedProduct?.category])) {
            categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + viewWeight);
        }
    }

    const collaborative = new Map();
    for (const [sourceSku, profileWeight] of profile) {
        for (const neighbor of model.neighbors.get(sourceSku) || []) {
            if (!purchasedSkus.has(neighbor.sku)) collaborative.set(neighbor.sku, (collaborative.get(neighbor.sku) || 0) + profileWeight * neighbor.score);
        }
    }
    const segmentScores = model.segmentPopularity.get(segmentId) || new Map();
    const pinnedSkuOrder = segmentId ? (saved?.segments?.[segmentId]?.productSkus || []) : [];
    const pinnedSkus = new Set(pinnedSkuOrder);
    const maxValue = values => Math.max(0, ...values);
    // Build candidates before calculating content similarity for viewed products.
    const eligible = products.filter(product => {
        const sku = String(product.sku);
        return !purchasedSkus.has(sku) || pinnedSkus.has(sku) || viewedSkus.has(sku);
    });
    const candidates = eligible.length ? eligible : products;
    const maxCollaborative = maxValue([...collaborative.values()]);
    const viewSimilarityScores = new Map();
    // Keep the latest few views as the strongest signal so old browsing history
    // cannot drown out a customer's current interest.
    const focusedViews = viewedProducts.slice(0, 12);
    const totalViewWeight = focusedViews.reduce((sum, view) => sum + view.weight, 0);
    const maxViewWeight = maxValue(focusedViews.map(view => view.weight));
    const focusedViewWeights = new Map(focusedViews.map(view => [view.sku, view.weight]));
    if (focusedViews.length) {
        for (const product of candidates) {
            const features = getProductFeatures(product);
            const score = totalViewWeight
                ? focusedViews.reduce((sum, view) => sum + view.weight * calculateContentSimilarity(features, view.features), 0) / totalViewWeight
                : 0;
            viewSimilarityScores.set(String(product.sku), score);
        }
    }
    const maxSegment = maxValue([...segmentScores.values()]);
    const maxGlobal = maxValue([...model.globalPopularity.values()]);
    const maxCategory = maxValue([...categoryAffinity.values()]);
    // Keep products the customer viewed in the candidate set so repeated interest
    // can surface the exact product across storefront listings.
    const ranked = candidates.map(product => {
        const sku = String(product.sku);
        const categoryScore = getProductCategories([product.categorySlug, product.category]).reduce((sum, category) => sum + (categoryAffinity.get(category) || 0), 0);
        const normalizedCategory = maxCategory ? Math.min(1, categoryScore / maxCategory) : 0;
        const cf = maxCollaborative ? (collaborative.get(sku) || 0) / maxCollaborative : 0;
        const exactView = maxViewWeight ? Math.min(1, (focusedViewWeights.get(sku) || 0) / maxViewWeight) : 0;
        const viewSimilarity = 0.5 * (viewSimilarityScores.get(sku) || 0) + 0.5 * exactView;
        const segment = maxSegment ? Math.min(1, (segmentScores.get(sku) || 0) / maxSegment) : 0;
        const popularity = maxGlobal ? Math.min(1, (model.globalPopularity.get(sku) || 0) / maxGlobal) : 0;
        const manual = pinnedSkus.has(sku) ? 0.08 : 0;
        const hasViewProfile = focusedViews.length > 0;
        const components = hasViewProfile ? [
            { value: 0.68 * viewSimilarity, reason: 'Cùng công dụng, danh mục hoặc đặc điểm với món bạn đã xem' },
            { value: 0.15 * cf, reason: 'Thường được mua cùng sản phẩm bạn quan tâm' },
            { value: 0.08 * normalizedCategory, reason: 'Cùng danh mục bạn quan tâm' },
            { value: 0.04 * segment, reason: 'Được khách cùng phân khúc yêu thích' },
            { value: 0.03 * popularity, reason: 'Đang là xu hướng mua hàng' },
            { value: 0.02 * (pinnedSkus.has(sku) ? 1 : 0), reason: 'Được Floralia tuyển chọn' }
        ] : [
            { value: 0.50 * cf, reason: 'Dựa trên sản phẩm bạn đã mua' },
            { value: 0.24 * segment, reason: 'Được khách cùng phân khúc yêu thích' },
            { value: 0.15 * normalizedCategory, reason: 'Cùng danh mục bạn quan tâm' },
            { value: 0.11 * popularity, reason: 'Đang là xu hướng mua hàng' },
            { value: manual, reason: 'Được Floralia tuyển chọn' }
        ];
        const reason = components.sort((a, b) => b.value - a.value)[0];
        return { product, category: getProductCategories(product.category)[0] || 'other', score: components.reduce((sum, item) => sum + item.value, 0), reason: reason.value > 0 ? reason.reason : 'Gợi ý nổi bật từ Floralia' };
    }).sort((a, b) => b.score - a.score || (Number(b.product.sold) || 0) - (Number(a.product.sold) || 0));

    const selected = [];
    const categoryCounts = new Map();
    const remaining = [...ranked];
    // The most recently viewed product gets the first slot, while the admin's
    // curated products fill the slots after it in the configured order.
    const prioritySkus = [focusedViews[0]?.sku, ...pinnedSkuOrder].filter(Boolean);
    for (const sku of prioritySkus) {
        const index = remaining.findIndex(item => String(item.product.sku) === sku);
        if (index < 0 || selected.length >= 8) continue;
        const [item] = remaining.splice(index, 1);
        selected.push(item.product);
        categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
    }
    while (selected.length < 8 && remaining.length) {
        let index = remaining.findIndex(item => (categoryCounts.get(item.category) || 0) < 3);
        if (index < 0) index = 0;
        const [item] = remaining.splice(index, 1);
        selected.push(item.product);
        categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
    }
    const segmentName = SEGMENTS.find(segment => segment.id === segmentId)?.name || 'Xu hướng mua hàng';
    const reasons = new Map(ranked.map(item => [String(item.product.sku), item.reason]));
    return {
        segmentId,
        segmentName,
        modelVersion: 'hybrid-itemcf-v3',
        modelStats: { trainedOrders: orders.filter(isCompletedOrder).length, learnedProducts: model.neighbors.size, customerProfileProducts: profile.size, customerViewProducts: viewedSkus.size },
        recommendationReasons: selected.map(product => ({ sku: String(product.sku), reason: reasons.get(String(product.sku)) })),
        products: selected
    };
}

module.exports = { SEGMENTS, setCollections, getAdminData, saveSegment, getForCustomer, recordProductView, recommendationEvents, notifyOrdersChanged };
