const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const PasswordResetService = require('../services/password-reset-service');

const JWT_SECRET = process.env.JWT_SECRET;

const NAME_RE = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function toPublicUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || '',
        role: user.role || 'user'
    };
}

// POST /api/auth/signup
async function signup(req, res) {
    try {
        const fullName = String(req.body.fullName || '')
            .trim()
            .replace(/\s+/g, ' ');

        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();

        const phone = String(req.body.phone || '').trim();
        const password = String(req.body.password || '');

        if (!NAME_RE.test(fullName) || fullName.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên không hợp lệ.'
            });
        }

        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ.'
            });
        }

        if (!PHONE_RE.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ.'
            });
        }

        if (!PASS_RE.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.'
            });
        }

        if (await User.exists(email)) {
            return res.status(409).json({
                success: false,
                field: 'email',
                message: 'Email này đã được đăng ký.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            fullName,
            email,
            phone,
            password: hashedPassword,
            avatar: '',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await User.create(newUser);

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công!',
            user: toPublicUser({
                ...newUser,
                _id: result.insertedId
            })
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                field: 'email',
                message: 'Email này đã được đăng ký.'
            });
        }

        console.error('Lỗi đăng ký:', err);

        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ, vui lòng thử lại sau.'
        });
    }
}

// POST /api/auth/login
async function login(req, res) {
    try {
        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();

        const password = String(req.body.password || '');

        const user = await User.findByEmail(email);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không chính xác.'
            });
        }

        if (user.isBlocked || user.status === 'blocked') {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên.'
            });
        }

        const token = jwt.sign(
            { id: user._id.toString() },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: toPublicUser(user)
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);

        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ, vui lòng thử lại sau.'
        });
    }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Email không hợp lệ.'
        });
    }

    try {
        await PasswordResetService.requestPasswordReset(email);
        res.json({
            success: true,
            message: 'Nếu email này đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.'
        });
    } catch (err) {
        console.error('Lỗi gửi email đặt lại mật khẩu:', err);
        res.status(503).json({
            success: false,
            message: 'Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.'
        });
    }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({
            success: false,
            message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        });
    }
    if (!PASS_RE.test(password)) {
        return res.status(400).json({
            success: false,
            message: 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.'
        });
    }

    try {
        const updated = await PasswordResetService.resetPassword(token, password);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
            });
        }
        res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' });
    } catch (err) {
        console.error('Lỗi đặt lại mật khẩu:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật mật khẩu lúc này. Vui lòng thử lại.'
        });
    }
}

// Middleware kiểm tra đăng nhập
async function attachActiveUser(req, res, next) {
    const user = await User.getById(req.userId);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.' });
    }
    if (user.isBlocked || user.status === 'blocked') {
        return res.status(403).json({
            success: false,
            code: 'ACCOUNT_BLOCKED',
            message: 'Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên.'
        });
    }
    req.authenticatedUser = user;
    return next();
}

async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : '';

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        await attachActiveUser(req, res, next);
    } catch {
        res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
        });
    }
}

async function optionalAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : '';

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        await attachActiveUser(req, res, next);
    } catch {
        res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
        });
    }
}

async function requireAdmin(req, res, next) {
    try {
        const user = await User.getById(req.userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện thao tác này.'
            });
        }

        next();
    } catch (error) {
        console.error('Lỗi xác thực quyền quản trị:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể xác thực quyền quản trị.'
        });
    }
}

module.exports = {
    signup,
    login,
    forgotPassword,
    resetPassword,
    requireAuth,
    optionalAuth,
    requireAdmin,
    toPublicUser
};
