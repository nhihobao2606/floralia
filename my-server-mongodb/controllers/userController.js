const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { toPublicUser } = require('./authController');

const NAME_RE = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;
const PHONE_RE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

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
        const phone = String(req.body.phone || '').trim();

        if (fullName && (!NAME_RE.test(fullName) || fullName.length < 2)) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên không hợp lệ.'
            });
        }

        if (phone && !PHONE_RE.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ.'
            });
        }

        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (phone) updateData.phone = phone;
        if ('avatar' in req.body) {
            updateData.avatar = req.body.avatar ? String(req.body.avatar) : '';
        }

        await User.update(req.userId, updateData);

        const updatedUser = await User.getById(req.userId);

        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công!',
            user: toPublicUser(updatedUser || { ...req.body, _id: req.userId })
        });
    } catch (err) {
        console.error('Lỗi cập nhật người dùng:', err);
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

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};
