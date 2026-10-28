const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

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

// Middleware kiểm tra đăng nhập
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : '';

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch {
        res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
        });
    }
}

module.exports = {
    signup,
    login,
    requireAuth,
    toPublicUser
};