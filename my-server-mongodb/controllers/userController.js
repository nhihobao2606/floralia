const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { toPublicUser } = require('./authController');

const NAME_RE = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;

function normalizePhoneNumber(phone) {
    return String(phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
}

function toAdminUser(user) {
    const isBlocked = Boolean(user.isBlocked || user.status === 'blocked');
    return {
        id: user._id ? user._id.toString() : user.id,
        fullName: user.fullName || 'Người dùng',
        email: user.email || '',
        phone: normalizePhoneNumber(user.phone),
        avatar: user.avatar || '',
        role: user.role || 'customer',
        status: isBlocked ? 'blocked' : 'active',
        isBlocked,
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
        totalSpent: Number(user.totalSpent || 0),
        orderCount: Number(user.orderCount || 0)
    };
}
const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function avatarWithinLimit(avatar) {
    if (!String(avatar || '').startsWith('data:image/')) return true;
    const match = String(avatar).match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
    return Boolean(match && Buffer.from(match[1], 'base64').length <= 10 * 1024 * 1024);
}

async function createUserForAdmin(req, res) {
    try {
        const fullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ');
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = normalizePhoneNumber(req.body.phone);
        const password = String(req.body.password || '');
        const role = req.body.role === 'admin' ? 'admin' : 'user';
        const avatar = String(req.body.avatar || '').trim();

        if (!avatarWithinLimit(avatar)) {
            return res.status(400).json({ success: false, field: 'avatar', message: 'Ảnh đại diện phải là JPG, PNG hoặc WebP và tối đa 10 MB.' });
        }

        if (!NAME_RE.test(fullName) || fullName.length < 2) {
            return res.status(400).json({ success: false, message: 'Họ và tên không hợp lệ.' });
        }
        if (email && !EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
        }
        if (!PHONE_RE.test(phone)) {
            return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
        }
        if (await User.existsByPhone(phone)) {
            return res.status(409).json({ success: false, field: 'phone', message: 'Số điện thoại này đã được dùng cho tài khoản khác.' });
        }
        if (!PASS_RE.test(password)) {
            return res.status(400).json({ success: false, message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.' });
        }
        if (email && await User.existsByEmail(email)) {
            return res.status(409).json({ success: false, field: 'email', message: 'Email này đã được đăng ký.' });
        }

        const now = new Date();
        const isBlocked = req.body.status === 'blocked';
        const newUser = {
            fullName, ...(email ? { email } : {}), phone, avatar,
            password: await bcrypt.hash(password, 10),
            role,
            isBlocked,
            status: isBlocked ? 'blocked' : 'active',
            createdAt: now,
            updatedAt: now,
        };
        const result = await User.create(newUser);
        res.status(201).json({
            success: true,
            message: 'Đã tạo tài khoản người dùng thành công.',
            user: toAdminUser({ ...newUser, _id: result.insertedId }),
        });
    } catch (err) {
        if (err.code === 11000) {
            const field = err.keyPattern?.email ? 'email' : 'phone';
            return res.status(409).json({ success: false, field, message: field === 'email' ? 'Email n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u0103ng k\u00fd.' : 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c d\u00f9ng cho t\u00e0i kho\u1ea3n kh\u00e1c.' });
        }
        console.error('Lỗi tạo tài khoản người dùng:', err);
        res.status(500).json({ success: false, message: 'Không thể tạo tài khoản người dùng.' });
    }
}

// GET /api/users/me
async function getProfile(req, res) {
    try {
        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin người dùng.'
            });
        }

        res.json({
            success: true,
            user: toPublicUser(user)
        });
    } catch (err) {
        console.error('Lỗi lấy thông tin người dùng:', err);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ, vui lòng thử lại sau.'
        });
    }
}

// PUT /api/users/me
async function updateProfile(req, res) {
    try {
        const fullName = String(req.body.fullName || '')
            .trim()
            .replace(/\s+/g, ' ');
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = normalizePhoneNumber(req.body.phone);
        const gender = String(req.body.gender || '').trim();
        const birthDate = String(req.body.birthDate || '').trim();

        if (fullName && (!NAME_RE.test(fullName) || fullName.length < 2)) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên không hợp lệ.'
            });
        }

        if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
            return res.status(400).json({ success: false, field: 'email', message: 'Địa chỉ email không hợp lệ.' });
        }

        if (email && await User.existsByEmail(email, req.userId)) {
            return res.status(409).json({ success: false, field: 'email', message: 'Email này đã được đăng ký.' });
        }

        if (phone && !PHONE_RE.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ.'
            });
        }

        if (gender && !['female', 'male', 'other'].includes(gender)) {
            return res.status(400).json({ success: false, message: 'Giới tính không hợp lệ.' });
        }

        if (birthDate) {
            const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
            const today = new Date();
            today.setUTCHours(23, 59, 59, 999);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(parsedBirthDate.getTime()) ||
                parsedBirthDate.toISOString().slice(0, 10) !== birthDate || parsedBirthDate > today) {
                return res.status(400).json({ success: false, message: 'Ngày sinh không hợp lệ.' });
            }
        }

        if (phone && await User.existsByPhone(phone, req.userId)) {
            return res.status(409).json({ success: false, field: 'phone', message: 'Số điện thoại này đã được dùng cho tài khoản khác.' });
        }

        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if ('email' in req.body) updateData.email = email;
        if (phone) {
            updateData.phone = phone;
        }
        if ('gender' in req.body) updateData.gender = gender;
        if ('birthDate' in req.body) updateData.birthDate = birthDate;
        if ('avatar' in req.body) {
            updateData.avatar = req.body.avatar ? String(req.body.avatar) : '';
            if (!avatarWithinLimit(updateData.avatar)) {
                return res.status(400).json({ success: false, field: 'avatar', message: 'Ảnh đại diện phải là JPG, PNG hoặc WebP và tối đa 10 MB.' });
            }
        }

        const updateResult = await User.updateProfile(req.userId, updateData);
        if (updateResult?.matchedCount !== 1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để cập nhật.' });
        }

        const updatedUser = await User.getById(req.userId);
        if (!updatedUser ||
            ('email' in req.body && String(updatedUser.email || '') !== email) ||
            ('birthDate' in req.body && updatedUser.birthDate !== birthDate)) {
            return res.status(500).json({ success: false, message: 'Không thể xác nhận thông tin đã được lưu. Vui lòng thử lại.' });
        }

        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công!',
            user: toPublicUser(updatedUser || { ...req.body, _id: req.userId })
        });
    } catch (err) {
        console.error('Lỗi cập nhật người dùng:', err);
        if (err.code === 11000 && err.keyPattern?.email) {
            return res.status(409).json({ success: false, field: 'email', message: 'Email này đã được đăng ký.' });
        }
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật. Vui lòng thử lại.'
        });
    }
}

// PUT /api/users/me/password
async function changePassword(req, res) {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');

        if (!currentPassword) {
            return res.status(400).json({
                success: false,
                field: 'currentPassword',
                message: 'Vui lòng nhập mật khẩu hiện tại.'
            });
        }

        if (!PASS_RE.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới tối thiểu 8 ký tự, bao gồm cả chữ và số.'
            });
        }

        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                field: 'currentPassword',
                message: 'Mật khẩu hiện tại không chính xác.'
            });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(req.userId, hashedNew);

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công!'
        });
    } catch (err) {
        console.error('Lỗi đổi mật khẩu:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể đổi mật khẩu. Vui lòng thử lại.'
        });
    }
}

async function getAllUsersForAdmin(req, res) {
    try {
        const users = await User.getAllUsers();
        const normalized = users.map(toAdminUser);

        res.json({
            success: true,
            users: normalized,
            summary: {
                total: normalized.length,
                active: normalized.filter((user) => user.status !== 'blocked').length,
                blocked: normalized.filter((user) => user.status === 'blocked').length
            }
        });
    } catch (err) {
        console.error('Lỗi lấy danh sách người dùng:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể tải danh sách người dùng.'
        });
    }
}

async function updateUserForAdmin(req, res) {
    try {
        const { id } = req.params;
        const user = await User.getById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng cần cập nhật.'
            });
        }

        const nextFullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ');
        const nextPhone = normalizePhoneNumber(req.body.phone);
        const requestedRole = req.body.role ? String(req.body.role) : undefined;
        const nextRole = requestedRole === 'customer' ? 'user' : requestedRole;
        const nextAvatar = req.body.avatar !== undefined ? String(req.body.avatar || '').trim() : undefined;
        if (nextAvatar !== undefined && !avatarWithinLimit(nextAvatar)) {
            return res.status(400).json({ success: false, field: 'avatar', message: 'Ảnh đại diện phải là JPG, PNG hoặc WebP và tối đa 10 MB.' });
        }

        if (nextFullName && (!NAME_RE.test(nextFullName) || nextFullName.length < 2)) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên không hợp lệ.'
            });
        }

        if (nextPhone && !PHONE_RE.test(nextPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ.'
            });
        }

        if (nextPhone && await User.existsByPhone(nextPhone, id)) {
            return res.status(409).json({ success: false, field: 'phone', message: 'Số điện thoại này đã được dùng cho tài khoản khác.' });
        }

        if (nextRole && !['user', 'admin'].includes(nextRole)) {
            return res.status(400).json({
                success: false,
                message: 'Vai trò không hợp lệ.'
            });
        }

        const updateData = {};
        if (nextFullName) updateData.fullName = nextFullName;
        if (nextPhone) {
            updateData.phone = nextPhone;
        }
        if (nextAvatar !== undefined) updateData.avatar = nextAvatar;
        if (nextRole) updateData.role = nextRole;

        if (Object.keys(updateData).length === 0) {
            return res.json({
                success: true,
                message: 'Không có thay đổi nào được cập nhật.',
                user: toAdminUser(user)
            });
        }

        await User.update(id, updateData);

        const updatedUser = await User.getById(id);
        res.json({
            success: true,
            message: 'Cập nhật thông tin người dùng thành công.',
            user: toAdminUser(updatedUser)
        });
    } catch (err) {
        console.error('Lỗi cập nhật thông tin người dùng:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật thông tin người dùng.'
        });
    }
}

async function toggleUserStatusForAdmin(req, res) {
    try {
        const { id } = req.params;
        const { action, reason } = req.body || {};
        if (!['block', 'unblock'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Thao tác không hợp lệ.' });
        }
        const nextIsBlocked = action === 'block';

        const updatedUser = await User.updateStatus(id, {
            isBlocked: nextIsBlocked,
            status: nextIsBlocked ? 'blocked' : 'active',
            ...(nextIsBlocked ? { blockReason: String(reason || '').trim(), blockedAt: new Date(), blockedBy: req.userId } : { blockReason: '', blockedAt: null, blockedBy: null }),
            updatedAt: new Date()
        }, { action, reason: String(reason || '').trim(), adminId: String(req.userId), at: new Date() });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng cần cập nhật.' });
        }
        const expectedStatus = nextIsBlocked ? 'blocked' : 'active';
        if (Boolean(updatedUser.isBlocked) !== nextIsBlocked || updatedUser.status !== expectedStatus) {
            console.error('Account status read back from MongoDB does not match the requested state.', {
                userId: id,
                expectedStatus,
                actualStatus: updatedUser.status,
                actualIsBlocked: updatedUser.isBlocked
            });
            return res.status(500).json({
                success: false,
                message: 'Kh\u00f4ng x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c tr\u1ea1ng th\u00e1i t\u00e0i kho\u1ea3n \u0111\u00e3 l\u01b0u trong c\u01a1 s\u1edf d\u1eef li\u1ec7u.'
            });
        }
        res.json({
            success: true,
            message: nextIsBlocked ? 'Đã khóa tài khoản người dùng.' : 'Đã mở khóa tài khoản người dùng.',
            user: toAdminUser(updatedUser)
        });
    } catch (err) {
        console.error('Lỗi cập nhật trạng thái người dùng:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật trạng thái người dùng.'
        });
    }
}

module.exports = {
    createUserForAdmin,
    getProfile,
    updateProfile,
    changePassword,
    getAllUsersForAdmin,
    updateUserForAdmin,
    toggleUserStatusForAdmin
};
