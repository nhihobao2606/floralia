const { ObjectId } = require('mongodb');

let collection;

function setCollection(col) {
    collection = col;
}

function getCollection() {
    if (!collection) {
        throw new Error('ChatbotMessages collection chưa được khởi tạo trong chatMessage model');
    }
    return collection;
}

async function saveMessage({ sessionId, sender, text, suggestedProducts = [] }) {
    const col = getCollection();
    const doc = {
        sessionId: String(sessionId || 'default_session'),
        sender: sender === 'user' ? 'user' : 'bot',
        text: String(text || '').trim(),
        suggestedProducts: Array.isArray(suggestedProducts) ? suggestedProducts : [],
        createdAt: new Date()
    };
    const res = await col.insertOne(doc);
    return {
        id: String(res.insertedId),
        _id: res.insertedId,
        ...doc
    };
}

async function getMessagesBySession(sessionId) {
    const col = getCollection();
    const docs = await col.find({ sessionId: String(sessionId || 'default_session') })
        .sort({ createdAt: 1 })
        .toArray();

    return docs.map(d => ({
        id: String(d._id),
        sessionId: d.sessionId,
        sender: d.sender,
        text: d.text,
        suggestedProducts: d.suggestedProducts || [],
        timestamp: d.createdAt
    }));
}

async function clearSessionMessages(sessionId) {
    const col = getCollection();
    return await col.deleteMany({ sessionId: String(sessionId || 'default_session') });
}

module.exports = {
    setCollection,
    getCollection,
    saveMessage,
    getMessagesBySession,
    clearSessionMessages
};
