const { ObjectId } = require('mongodb');
const {
    buildProductSearchText,
    embedText,
    cosineSimilarity,
    generateChatResponse,
    consultWithFullContext
} = require('../services/geminiService');
const AdminProduct = require('../models/adminProduct');
const ChatMessage = require('../models/chatMessage');

let productsCollection;
let isListenerAttached = false;

// Bộ nhớ đệm sản phẩm trong RAM để tạo ngữ cảnh Context siêu tốc
let cachedActiveProducts = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 phút

function invalidateProductsCache() {
    cachedActiveProducts = null;
    lastCacheTimestamp = 0;
}

function setCollection(collection) {
    productsCollection = collection;
    invalidateProductsCache();

    if (!isListenerAttached && AdminProduct && AdminProduct.productEvents) {
        isListenerAttached = true;
        AdminProduct.productEvents.on('changed', async ({ action, productId }) => {
            invalidateProductsCache();
            if (!productId || action === 'deleted' || !productsCollection) return;
            try {
                const idFilter = ObjectId.isValid(productId) && String(productId).length === 24
                    ? { _id: new ObjectId(productId) }
                    : { _id: productId };

                const product = await productsCollection.findOne(idFilter);
                if (product) {
                    const searchText = buildProductSearchText(product);
                    const vector = await embedText(searchText);
                    if (Array.isArray(vector) && vector.length === 768) {
                        await productsCollection.updateOne(
                            { _id: product._id },
                            {
                                $set: {
                                    search_text: searchText,
                                    embedding: vector,
                                    embeddingUpdatedAt: new Date()
                                }
                            }
                        );
                    }
                }
            } catch (err) {
                console.error('Lỗi tự động cập nhật embedding cho sản phẩm:', err.message);
            }
        });
    }
}

function getCollection() {
    if (!productsCollection) {
        throw new Error('Products collection chưa được khởi tạo trong chatController');
    }
    return productsCollection;
}

async function getActiveProductsCached() {
    const now = Date.now();
    if (cachedActiveProducts && Array.isArray(cachedActiveProducts) && (now - lastCacheTimestamp) < CACHE_TTL_MS) {
        return cachedActiveProducts;
    }
    const collection = getCollection();
    const products = await collection.find({
        isActive: { $ne: false },
        stock: { $gt: 0 }
    }).toArray();

    cachedActiveProducts = products;
    lastCacheTimestamp = now;
    return products;
}

function buildContextString(products) {
    if (!Array.isArray(products) || products.length === 0) return '';
    return products.map(p => {
        const tags = Array.isArray(p.tags) ? p.tags.join(', ') : '';
        const usage = Array.isArray(p.usage) ? p.usage.slice(0, 3).join('; ') : '';
        const category = p.category ? `[${p.category}] ` : '';
        return `- [${p.sku}] ${category}${p.name} | Giá: ${Number(p.price || 0).toLocaleString('vi-VN')}đ | Kho: còn ${p.stock} hộp | Vị: ${p.flavorNote || 'Thơm thanh thảo mộc tự nhiên'} | Thẻ & Tác dụng: ${tags}; ${usage}`;
    }).join('\n');
}

function formatProductImage(thumbnail) {
    if (!thumbnail) return null;
    const str = String(thumbnail);
    if (str.startsWith('http://') || str.startsWith('https://')) return str;
    if (str.startsWith('/products/image/')) return `http://localhost:3002${str}`;
    return `http://localhost:3002/products/image/${encodeURIComponent(str)}`;
}

// Hàm tìm kiếm từ khóa dự phòng cục bộ
function matchProductsLocally(message, products) {
    if (!Array.isArray(products) || products.length === 0) return [];
    const lower = (message || '').toLowerCase();
    const isSetRequested = lower.includes('set') || lower.includes('hộp quà') || lower.includes('quà biếu') || lower.includes('quà tặng');

    const scored = products.map(p => {
        let score = 0;
        const nameLower = (p.name || '').toLowerCase();
        const catLower = (p.category || '').toLowerCase();
        const tagsLower = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        const usageLower = Array.isArray(p.usage) ? p.usage.join(' ').toLowerCase() : '';
        const flavorLower = (p.flavorNote || '').toLowerCase();
        const fullText = `${nameLower} ${catLower} ${tagsLower} ${usageLower} ${flavorLower}`;

        if (isSetRequested) {
            if (nameLower.includes('set') || catLower.includes('quà') || tagsLower.includes('quà')) score += 8;
        }

        const keywords = ['huyết áp', 'ngủ ngon', 'mất ngủ', 'an thần', 'dưỡng nhan', 'mụn', 'giảm mụn', 'sáng da', 'giảm cân', 'thanh nhiệt', 'mát gan', 'tiêu hóa', 'tim mạch', 'ngọt thanh', 'thư giãn'];
        for (const kw of keywords) {
            if (lower.includes(kw) && fullText.includes(kw)) {
                score += 5;
            }
        }

        const words = lower.split(/\s+/).filter(w => w.length > 2);
        for (const w of words) {
            if (fullText.includes(w)) score += 1;
        }

        return { ...p, _localScore: score };
    });

    scored.sort((a, b) => b._localScore - a._localScore);
    return scored.filter(p => p._localScore > 0).slice(0, 4);
}

async function handleChatConsultation(req, res) {
    try {
        const { message, sessionId, history = [] } = req.body || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
        }

        const trimmedMessage = message.trim();
        const session = (sessionId && String(sessionId).trim()) ? String(sessionId).trim() : ('sess_' + Date.now());

        // BƯỚC 1: Lưu ngay tin nhắn của người dùng vào MongoDB Database
        try {
            await ChatMessage.saveMessage({
                sessionId: session,
                sender: 'user',
                text: trimmedMessage
            });
        } catch (dbErr) {
            console.warn('Lỗi lưu tin nhắn user vào MongoDB:', dbErr.message);
        }

        // BƯỚC 2: Lấy danh sách sản phẩm thực tế từ Database để tạo ngữ cảnh Context
        const allActiveProducts = await getActiveProductsCached();
        const productContext = buildContextString(allActiveProducts);

        // BƯỚC 3: Gọi Gemini API với ngữ cảnh Context để trích xuất từ khóa, chọn sản phẩm và viết lời tư vấn
        let aiResult = null;
        try {
            aiResult = await consultWithFullContext({
                message: trimmedMessage,
                history,
                productContext
            });
        } catch (callErr) {
            console.error('Lỗi khi gọi consultWithFullContext:', callErr.message);
        }

        // BƯỚC 4: Vào Context lựa chọn những sản phẩm phù hợp nhất để hiển thị thẻ UI
        let matchedTeas = [];
        let reply = '';

        if (aiResult && Array.isArray(aiResult.selectedSkus) && aiResult.selectedSkus.length > 0) {
            matchedTeas = allActiveProducts.filter(p => aiResult.selectedSkus.includes(p.sku));
        }

        if (!matchedTeas || matchedTeas.length < 2) {
            const localMatches = matchProductsLocally(trimmedMessage, allActiveProducts);
            for (const item of localMatches) {
                if (!matchedTeas.some(m => m.sku === item.sku)) {
                    matchedTeas.push(item);
                    if (matchedTeas.length >= 3) break;
                }
            }
        }

        if (matchedTeas.length === 0) {
            matchedTeas = allActiveProducts.slice(0, 3);
        }

        if (aiResult && typeof aiResult.reply === 'string' && aiResult.reply.trim().length > 20) {
            reply = aiResult.reply.trim();
        } else {
            const t1 = matchedTeas[0];
            const t2 = matchedTeas[1];
            reply = `Chào bạn, lắng nghe nhu cầu "${trimmedMessage}" của bạn, Floralia xin gợi ý các dòng trà tinh tế, giàu dưỡng chất và phù hợp nhất hiện có tại cửa hàng:\n\n` +
                `1. **${t1.name}**: ${t1.flavorNote ? 'Hương vị ' + t1.flavorNote + '. ' : ''}Công dụng: ${(t1.tags || []).slice(0, 3).join(', ') || 'Thanh lọc, dưỡng nhan'}. Giá: ${Number(t1.price || 0).toLocaleString('vi-VN')}đ (Kho: còn ${t1.stock} hộp).\n` +
                (t2 ? `2. **${t2.name}**: ${t2.flavorNote ? 'Hương vị ' + t2.flavorNote + '. ' : ''}Công dụng: ${(t2.tags || []).slice(0, 3).join(', ') || 'Bồi bổ sức khỏe'}. Giá: ${Number(t2.price || 0).toLocaleString('vi-VN')}đ (Kho: còn ${t2.stock} hộp).\n\n` : '\n') +
                `Mời bạn xem chi tiết các sản phẩm được đề xuất bên dưới để chọn loại trà ưng ý nhất nhé!`;
        }

        // BƯỚC 5: Định dạng dữ liệu thẻ sản phẩm
        const suggestedProducts = matchedTeas.slice(0, 4).map(tea => ({
            id: tea._id ? String(tea._id) : (tea.sku || ''),
            sku: tea.sku || '',
            slug: tea.slug || '',
            name: tea.name || '',
            category: tea.category || '',
            price: Number(tea.price || 0),
            oldPrice: Number(tea.oldPrice || 0),
            discount: Number(tea.discount || 0),
            stock: Number(tea.stock || 0),
            flavorNote: tea.flavorNote || '',
            tags: Array.isArray(tea.tags) ? tea.tags.slice(0, 3) : [],
            imageUrl: formatProductImage(tea.thumbnail),
            variants: Array.isArray(tea.variants) ? tea.variants : []
        }));

        // BƯỚC 6: Lưu ngay câu trả lời của Bot và các sản phẩm gợi ý vào Database MongoDB
        let savedBotMessage = null;
        try {
            savedBotMessage = await ChatMessage.saveMessage({
                sessionId: session,
                sender: 'bot',
                text: reply,
                suggestedProducts
            });
        } catch (dbErr) {
            console.warn('Lỗi lưu tin nhắn bot vào MongoDB:', dbErr.message);
        }

        return res.json({
            sessionId: session,
            reply,
            suggestedProducts,
            message: savedBotMessage
        });
    } catch (error) {
        console.error('Chatbot API Error:', error);
        return res.status(500).json({
            error: 'Hệ thống tư vấn trà AI đang bận một chút, bạn vui lòng thử lại sau giây lát nhé!'
        });
    }
}

async function getSessionMessages(req, res) {
    try {
        const { sessionId } = req.query;
        if (!sessionId) {
            return res.json({ messages: [] });
        }
        const messages = await ChatMessage.getMessagesBySession(sessionId);
        return res.json({ messages });
    } catch (err) {
        console.error('Lỗi getSessionMessages:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function clearSessionMessages(req, res) {
    try {
        const { sessionId } = req.body || {};
        if (sessionId) {
            await ChatMessage.clearSessionMessages(sessionId);
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('Lỗi clearSessionMessages:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function syncProductEmbeddings(req, res) {
    try {
        const collection = getCollection();
        const products = await collection.find({}).toArray();

        let updatedCount = 0;
        const errors = [];

        for (const product of products) {
            try {
                const searchText = buildProductSearchText(product);
                const vector = await embedText(searchText);

                if (Array.isArray(vector) && vector.length === 768) {
                    await collection.updateOne(
                        { _id: product._id },
                        {
                            $set: {
                                search_text: searchText,
                                embedding: vector,
                                embeddingUpdatedAt: new Date()
                            }
                        }
                    );
                    updatedCount++;
                }
            } catch (err) {
                errors.push({ id: product._id, name: product.name, error: err.message });
            }
        }

        return res.json({
            success: true,
            total: products.length,
            updated: updatedCount,
            errors
        });
    } catch (error) {
        console.error('Sync embeddings error:', error);
        return res.status(500).json({ error: error.message });
    }
}

module.exports = {
    setCollection,
    handleChatConsultation,
    getSessionMessages,
    clearSessionMessages,
    syncProductEmbeddings
};
