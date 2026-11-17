const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const PasswordResetService = require('../services/password-reset-service');

const JWT_SECRET = process.env.JWT_SECRET;

const NAME_RE = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;

function normalizePhoneNumber(phone) {
    return String(phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
}
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function toPublicUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: normalizePhoneNumber(user.phone),
        avatar: user.avatar || '',
        role: user.role || 'user',
        gender: user.gender || '',
        birthDate: user.birthDate || ''
    };
}

// POST /api/auth/check-availability
async function checkSignupAvailability(req, res) {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const rawPhone = String(req.body.phone || '').trim();
        const phone = rawPhone ? normalizePhoneNumber(rawPhone) : '';

        if (email && !EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, field: 'email', message: 'Email không hợp lệ.' });
        }
        if (phone && !PHONE_RE.test(phone)) {
            return res.status(400).json({ success: false, field: 'phone', message: 'Số điện thoại không hợp lệ.' });
        }
        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập email hoặc số điện thoại cần kiểm tra.' });
        }

        const [existingEmail, existingPhone] = await Promise.all([
            email ? User.existsByEmail(email) : null,
            phone ? User.existsByPhone(phone) : null
        ]);
        if (existingEmail) {
            return res.status(409).json({ success: false, field: 'email', message: 'Email này đã được sử dụng cho tài khoản khác.' });
        }
        if (existingPhone) {
            return res.status(409).json({ success: false, field: 'phone', message: 'Số điện thoại này đã được đăng ký.' });
        }
        return res.json({ success: true });
    } catch (error) {
        console.error('Không thể kiểm tra thông tin đăng ký:', error);
        return res.status(500).json({ success: false, message: 'Không thể kiểm tra thông tin đăng ký lúc này.' });
    }
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

        const phone = normalizePhoneNumber(req.body.phone);
        const password = String(req.body.password || '');

        if (!NAME_RE.test(fullName) || fullName.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên không hợp lệ.'
            });
        }

        if (email && !EMAIL_RE.test(email)) {
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

        if (req.body.termsAccepted !== true) {
            return res.status(400).json({ success: false, message: 'Vui l\u00f2ng ch\u1ea5p nh\u1eadn c\u00e1c ch\u00ednh s\u00e1ch.' });
        }

        if (!PASS_RE.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.'
            });
        }

        if (email && await User.existsByEmail(email)) {
            return res.status(409).json({
                success: false,
                field: 'email',
                message: 'Email này đã được sử dụng cho tài khoản khác.'
            });
        }

        if (await User.existsByPhone(phone)) {
            return res.status(409).json({ success: false, field: 'phone', message: 'Số điện thoại này đã được đăng ký.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            fullName,
            ...(email ? { email } : {}),
            phone,
            password: hashedPassword,
            avatar: '',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
            termsAcceptedAt: new Date()
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
            const field = err.keyPattern?.email ? 'email' : 'phone';
            return res.status(409).json({
                success: false,
                field,
                message: field === 'email'
                    ? 'Email này đã được sử dụng cho tài khoản khác.'
                    : 'Số điện thoại này đã được đăng ký.'
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
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || '').trim();

        const password = String(req.body.password || '');

        let user = null;
        if (identifier.includes('@')) {
            user = await User.findByEmail(identifier.toLowerCase());
            if (!user) {
                return res.status(404).json({
                    success: false,
                    code: 'EMAIL_NOT_REGISTERED',
                    message: 'Email chưa được đăng ký.'
                });
            }
        } else {
            const matches = await User.findByPhone(identifier);
            if (matches.length > 1) {
                return res.status(409).json({ success: false, message: 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i n\u00e0y li\u00ean k\u1ebft v\u1edbi nhi\u1ec1u t\u00e0i kho\u1ea3n. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp b\u1eb1ng email.' });
            }
            user = matches[0] || null;
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Th\u00f4ng tin \u0111\u0103ng nh\u1eadp kh\u00f4ng ch\u00ednh x\u00e1c.'
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
    checkSignupAvailability,
    signup,
    login,
    forgotPassword,
    resetPassword,
    requireAuth,
    optionalAuth,
    requireAdmin,
    toPublicUser
};
