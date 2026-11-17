const { ObjectId } = require('mongodb');

let usersCollection;

function setCollection(collection) {
    usersCollection = collection;
}

function getIdFilter(id) {
    if (!id) return { _id: id };
    if (id instanceof ObjectId) return { _id: id };
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        return { _id: new ObjectId(id) };
    }
    return { _id: id };
}

async function findByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    const exactMatch = await usersCollection.findOne({ email: normalizedEmail });
    if (exactMatch) return exactMatch;

    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return usersCollection.findOne({
        email: { $regex: `^${escapedEmail}$`, $options: 'i' }
    });
}

function phoneCandidates(phone) {
    const compactPhone = String(phone || '').trim().replace(/\s+/g, '');
    if (!compactPhone) return [];
    const nationalPhone = compactPhone.startsWith('+84')
        ? `0${compactPhone.slice(3)}`
        : compactPhone;
    const internationalPhone = nationalPhone.startsWith('0')
        ? `+84${nationalPhone.slice(1)}`
        : compactPhone;
    return [...new Set([compactPhone, nationalPhone, internationalPhone])];
}

function findByPhone(phone) {
    const candidates = phoneCandidates(phone);
    if (!candidates.length) return Promise.resolve([]);

    const spacedPatterns = candidates.map(value => ({
        $regex: `^${value.split('').map(character => character === '+' ? '\\+' : character).join('\\s*')}$`
    }));
    return usersCollection.find({
        $or: [
            { phone: { $in: candidates } },
            ...spacedPatterns.map(pattern => ({ phone: pattern })),
        ],
    }).limit(2).toArray();
}

function existsByPhone(phone, excludeId) {
    const candidates = phoneCandidates(phone);
    const spacedPatterns = candidates.map(value => ({
        phone: { $regex: `^${value.split('').map(character => character === '+' ? '\\+' : character).join('\\s*')}$` }
    }));
    const filter = { $or: [{ phone: { $in: candidates } }, ...spacedPatterns] };
    if (excludeId) {
        const idFilter = getIdFilter(excludeId);
        filter._id = { $ne: idFilter._id };
    }
    return candidates.length
        ? usersCollection.findOne(filter, { projection: { _id: 1 } })
        : Promise.resolve(null);
}

function exists(email) {
    return usersCollection.findOne({ email }, { projection: { _id: 1 } });
}

async function existsByEmail(email, excludeId) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;
    const projection = { projection: { _id: 1 } };
    const filter = { email: normalizedEmail };
    if (excludeId) filter._id = { $ne: getIdFilter(excludeId)._id };
    return usersCollection.findOne(filter, {
        ...projection,
        collation: { locale: 'en', strength: 2 }
    });
}

function create(user) {
    return usersCollection.insertOne(user);
}

function getById(id) {
    const filter = getIdFilter(id);
    return usersCollection.findOne(filter);
}

function update(id, data) {
    const filter = getIdFilter(id);
    return usersCollection.updateOne(
        filter,
        { $set: { ...data, updatedAt: new Date() } }
    );
}

function updateProfile(id, data) {
    const filter = getIdFilter(id);
    const fields = { ...data };
    const update = { $set: { ...fields, updatedAt: new Date() } };
    if (Object.prototype.hasOwnProperty.call(fields, 'email') && !String(fields.email || '').trim()) {
        delete update.$set.email;
        update.$unset = { email: '' };
    }
    return usersCollection.updateOne(filter, update);
}

function updateStatus(id, data, historyEntry) {
    const filter = { ...getIdFilter(id), role: { $ne: 'admin' } };
    return usersCollection.updateOne(
        filter,
        { $set: { ...data, updatedAt: new Date() }, $push: { statusHistory: historyEntry } },
    ).then(result => {
        if (result.matchedCount !== 1) return null;

        // Re-read the document so callers can confirm the state MongoDB persisted.
        return getById(id);
    });
}

function updatePassword(id, hashedPassword) {
    const filter = getIdFilter(id);
    return usersCollection.updateOne(
        filter,
        { $set: { password: hashedPassword, updatedAt: new Date() } }
    );
}

function list(filter = {}, sort = { createdAt: -1 }) {
    return usersCollection.find(filter).sort(sort).toArray();
}

function getAllUsers() {
    return list({}, { createdAt: -1 });
}

function setPasswordResetToken(email, tokenHash, expiresAt) {
    return usersCollection.updateOne(
        { email },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
    );
}

function clearPasswordResetToken(tokenHash) {
    return usersCollection.updateOne(
        { passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' } }
    );
}

function updatePasswordWithResetToken(tokenHash, now, hashedPassword) {
    return usersCollection.updateOne(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } },
        {
            $set: { password: hashedPassword, updatedAt: now },
            $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' }
        }
    );
}

module.exports = {
    setCollection,
    findByEmail,
    findByPhone,
    exists,
    existsByEmail,
    existsByPhone,
    create,
    getById,
    update,
    updateProfile,
    updateStatus,
    updatePassword,
    list,
    getAllUsers,
    setPasswordResetToken,
    clearPasswordResetToken,
    updatePasswordWithResetToken
};
