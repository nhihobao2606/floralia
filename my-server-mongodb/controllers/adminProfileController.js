const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { toPublicUser } = require('./authController');

const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
function avatarWithinLimit(avatar) {
  if (!String(avatar || '').startsWith('data:image/')) return true;
  const match = String(avatar).match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
  return Boolean(match && Buffer.from(match[1], 'base64').length <= 10 * 1024 * 1024);
}

// GET /api/admin/profile - Lấy thông tin profile admin
async function getAdminProfile(req, res) {
  try {
    const user = req.authenticatedUser;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }
    res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error('getAdminProfile error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// PUT /api/admin/profile - Cập nhật thông tin profile admin
async function updateAdminProfile(req, res) {
  try {
    const user = req.authenticatedUser;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }

    const { fullName, phone, avatar } = req.body;
    if (avatar !== undefined && !avatarWithinLimit(avatar)) {
      return res.status(400).json({ success: false, field: 'avatar', message: 'Ảnh đại diện phải là JPG, PNG hoặc WebP và tối đa 10 MB.' });
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = String(fullName).trim().replace(/\s+/g, ' ');
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (avatar !== undefined) updateData.avatar = String(avatar);

    await User.update(req.userId, updateData);
    const updated = await User.getById(req.userId);

    res.json({ success: true, message: 'Cập nhật thông tin thành công!', user: toPublicUser(updated) });
  } catch (err) {
    console.error('updateAdminProfile error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// PUT /api/admin/profile/password - Đổi mật khẩu admin
async function changeAdminPassword(req, res) {
  try {
    const user = req.authenticatedUser;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    // Kiểm tra mật khẩu hiện tại
    const fullUser = await User.getById(req.userId);
    const isMatch = await bcrypt.compare(currentPassword, fullUser.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, field: 'currentPassword', message: 'Mật khẩu hiện tại không chính xác.' });
    }

    if (!PASS_RE.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.updatePassword(req.userId, hashed);

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('changeAdminPassword error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// PUT /api/admin/profile/security - Cập nhật cài đặt bảo mật (twoFactor, sessionTimeout)
async function updateAdminSecurity(req, res) {
  try {
    const user = req.authenticatedUser;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }

    const { twoFactorEnabled, sessionTimeout, loginNotification } = req.body;

    const security = {
      twoFactorEnabled: !!twoFactorEnabled,
      sessionTimeout: Number(sessionTimeout) || 480,
      loginNotification: loginNotification !== undefined ? !!loginNotification : true,
      updatedAt: new Date()
    };

    await User.update(req.userId, { security });
    res.json({ success: true, message: 'Cập nhật cài đặt bảo mật thành công!', security });
  } catch (err) {
    console.error('updateAdminSecurity error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

module.exports = { getAdminProfile, updateAdminProfile, changeAdminPassword, updateAdminSecurity };
