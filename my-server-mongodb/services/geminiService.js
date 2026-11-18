const { GoogleGenAI } = require('@google/genai');

let aiInstance = null;

function getGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in .env');
    }
    if (!aiInstance) {
        aiInstance = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    }
    return aiInstance;
}

function buildProductSearchText(product) {
    if (!product) return '';
    const parts = [
        `Tên trà: ${product.name || ''}`,
        product.category ? `Danh mục: ${product.category}` : '',
        product.flavorNote ? `Hương vị: ${product.flavorNote}` : '',
        Array.isArray(product.tags) && product.tags.length ? `Từ khóa/Công dụng: ${product.tags.join(', ')}` : '',
        Array.isArray(product.benefits) && product.benefits.length ? `Lợi ích: ${product.benefits.join(', ')}` : '',
        Array.isArray(product.usage) && product.usage.length ? `Tác dụng: ${product.usage.join(', ')}` : '',
        product.description ? `Mô tả: ${product.description}` : '',
        product.story ? `Câu chuyện trà: ${product.story}` : '',
        Array.isArray(product.instructions) && product.instructions.length ? `Cách pha: ${product.instructions.join(' ')}` : ''
    ].filter(Boolean);

    return parts.join('. ');
}

async function embedText(text) {
    const ai = getGenAI();
    const cleanText = (text || '').trim();
    if (!cleanText) return [];

    const res = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: cleanText,
        config: {
            outputDimensionality: 768
        }
    });

    if (res && res.embeddings && res.embeddings[0] && Array.isArray(res.embeddings[0].values)) {
        return res.embeddings[0].values;
    }
    throw new Error('Không nhận được vector embedding từ Gemini API');
}

function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
        return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeGeminiContents(history, currentMessage) {
    const rawTurns = [];

    if (Array.isArray(history)) {
        for (const item of history) {
            if (!item || !item.text) continue;
            const text = String(item.text).trim();
            if (!text) continue;

            const role = (item.role === 'assistant' || item.role === 'model' || item.sender === 'bot')
                ? 'model'
                : 'user';

            rawTurns.push({ role, text });
        }
    }

    // Nếu tin nhắn cuối trong rawTurns trùng với currentMessage, loại bỏ để tránh gửi 2 tin user liên tiếp
    if (rawTurns.length > 0 && rawTurns[rawTurns.length - 1].role === 'user' && rawTurns[rawTurns.length - 1].text === currentMessage.trim()) {
        rawTurns.pop();
    }

    // Thêm câu hỏi hiện tại của người dùng vào cuối
    rawTurns.push({ role: 'user', text: currentMessage.trim() });

    // Lọc theo quy tắc nghiêm ngặt của Gemini:
    // 1. Turn đầu tiên BẮT BUỘC phải là role 'user' (bỏ qua 'model' lời chào ở đầu)
    // 2. Không được có 2 turn cùng role liên tiếp
    const normalized = [];
    for (const turn of rawTurns) {
        if (normalized.length === 0) {
            if (turn.role === 'user') {
                normalized.push({
                    role: 'user',
                    parts: [{ text: turn.text }]
                });
            }
        } else {
            const prev = normalized[normalized.length - 1];
            if (prev.role === turn.role) {
                prev.parts[0].text += '\n' + turn.text;
            } else {
                normalized.push({
                    role: turn.role,
                    parts: [{ text: turn.text }]
                });
            }
        }
    }

    if (normalized.length === 0) {
        normalized.push({
            role: 'user',
            parts: [{ text: currentMessage.trim() }]
        });
    }

    return normalized.slice(-10);
}

async function generateChatResponse({ message, history = [], contextData, clientName = '' }) {
    const ai = getGenAI();

    const systemInstruction = `
Bạn là Floralia AI - Chuyên gia tư vấn trà cao cấp tại thương hiệu Floralia Tea.
Nhiệm vụ của bạn là lắng nghe nhu cầu của khách hàng (về hương vị, cảm xúc, sức khỏe, làm đẹp, làm quà tặng, thư giãn...) và tư vấn chính xác những loại trà phù hợp nhất từ kho của Floralia Tea.

DANH SÁCH SẢN PHẨM PHÙ HỢP HIỆN CÓ TRONG KHO FLORALIA TEA:
${contextData || "Hiện tại không tìm thấy trà khớp hoàn toàn trong kho hoặc kho đang cập nhật."}

QUY TẮC TƯ VẤN BẮT BUỘC:
1. CHỈ tư vấn và giới thiệu các sản phẩm có trong danh sách trên. TUYỆT ĐỐI KHÔNG tự bịa ra tên trà, thông số giá hoặc khuyến mãi không có thực.
2. Giọng văn: Tinh tế, nhẹ nhàng, ấm áp, lịch sự, am hiểu nghệ thuật thưởng trà Việt.
3. Khi gợi ý sản phẩm:
   - Nêu rõ tên sản phẩm và lý do vì sao loại trà đó hoàn hảo với nhu cầu của khách (phân tích hương vị, thành phần, tác dụng như dưỡng nhan, sáng da, dễ ngủ, giảm mụn, giải nhiệt...).
   - Nhắc đến mức giá và tình trạng còn hàng để khách yên tâm.
4. Độ dài: Ngắn gọn, súc tích (khoảng 100 - 150 từ), trình bày thoáng mắt, dễ đọc trên di động.
5. Kết thúc câu: Gợi ý cách thưởng thức trà ngon nhất hoặc mời khách nhấn vào thẻ sản phẩm bên dưới để xem chi tiết và đặt hàng.
`;

    const contents = normalizeGeminiContents(history, message);

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview'];
    for (const modelName of modelsToTry) {
        try {
            const apiCallPromise = ai.models.generateContent({
                model: modelName,
                contents,
                config: {
                    systemInstruction,
                    temperature: 0.3,
                    maxOutputTokens: 350
                }
            });

            // Giới hạn thời gian tối đa 5.5 giây cho mỗi lần gọi model để đảm bảo tốc độ phản hồi siêu nhanh
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout sau 5500ms khi gọi ${modelName}`)), 5500)
            );

            const response = await Promise.race([apiCallPromise, timeoutPromise]);

            if (response && response.text) {
                return response.text;
            }
        } catch (err) {
            console.warn(`Model ${modelName} failed (${err.message}), trying next...`);
        }
    }

    // Nếu SDK thất bại, thử gọi Direct REST một lần cuối với model gemini-3.1-flash-lite
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 350
                }
            }),
            signal: AbortSignal.timeout(4500)
        });
        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
    } catch (fetchErr) {
        console.error('Direct fetch fallback error:', fetchErr.message);
    }

    return 'Floralia rất vui được hỗ trợ bạn. Mời bạn tham khảo các dòng trà phù hợp bên dưới nhé!';
}

async function consultWithFullContext({ message, history = [], productContext }) {
    const ai = getGenAI();

    const systemInstruction = `
Bạn là Floralia AI - Chuyên gia tư vấn trà cao cấp tại thương hiệu Floralia Tea.

NGỮ CẢNH DANH SÁCH SẢN PHẨM FLORALIA TEA TRONG KHO:
${productContext}

NHIỆM VỤ CỦA BẠN:
1. Đọc câu hỏi của khách hàng và ngữ cảnh trò chuyện, trích xuất nhu cầu/từ khóa (ví dụ: cần set quà biếu hay trà lẻ; công dụng cho huyết áp, tim mạch, mất ngủ, giảm mụn, dưỡng nhan, thanh nhiệt; đối tượng: bố mẹ, sếp, bạn bè, bản thân; vị trà: ngọt thanh, không chát...).
2. Dựa vào các từ khóa và nhu cầu đó, đối chiếu vào NGỮ CẢNH KHO TRÀ ở trên và lựa chọn ra chính xác 2 - 4 sản phẩm phù hợp nhất (lấy theo mã SKU trong ngoặc vuông [SKU]).
3. Viết lời tư vấn tinh tế, lịch sự, đúng chuẩn chuyên gia trà Floralia Tea (ngắn gọn 100 - 150 từ, giải thích lý do vì sao chọn các sản phẩm này cho khách, nêu giá bán và số lượng còn trong kho).
4. TUYỆT ĐỐI CHỈ chọn sản phẩm có trong danh sách trên. Không tự bịa thông tin.

ĐỊNH DẠNG TRẢ VỀ (BẮT BUỘC LÀ JSON HỢP LỆ):
{
  "keywords": ["từ khóa 1", "từ khóa 2"],
  "selectedSkus": ["SKU1", "SKU2"],
  "reply": "Nội dung tư vấn chi tiết..."
}
`;

    const contents = normalizeGeminiContents(history, message);

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview'];
    for (const modelName of modelsToTry) {
        try {
            const apiCallPromise = ai.models.generateContent({
                model: modelName,
                contents,
                config: {
                    systemInstruction,
                    temperature: 0.2,
                    maxOutputTokens: 600,
                    responseMimeType: 'application/json'
                }
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout sau 6000ms khi gọi ${modelName}`)), 6000)
            );

            const response = await Promise.race([apiCallPromise, timeoutPromise]);

            if (response && response.text) {
                try {
                    const parsed = JSON.parse(response.text);
                    if (parsed && typeof parsed.reply === 'string') {
                        return {
                            reply: parsed.reply,
                            selectedSkus: Array.isArray(parsed.selectedSkus) ? parsed.selectedSkus : [],
                            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
                        };
                    }
                } catch (jsonErr) {
                    return {
                        reply: response.text,
                        selectedSkus: [],
                        keywords: []
                    };
                }
            }
        } catch (err) {
            console.warn(`consultWithFullContext model ${modelName} failed (${err.message}), trying next...`);
        }
    }

    return null;
}

module.exports = {
    getGenAI,
    buildProductSearchText,
    embedText,
    cosineSimilarity,
    generateChatResponse,
    consultWithFullContext
};
