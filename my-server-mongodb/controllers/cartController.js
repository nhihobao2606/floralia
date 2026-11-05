const Cart = require('../models/cart');
const User = require('../models/user');

// GET /api/cart - Lấy giỏ hàng của user đang đăng nhập từ collection Cart
async function getCart(req, res) {
    try {
        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        const cartDoc = await Cart.getByUser(req.userId, user.email);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({
            success: true,
            exists: Boolean(cartDoc),
            items: Array.isArray(cartDoc?.items) ? cartDoc.items : []
        });
    } catch (err) {
        console.error('Lỗi lấy giỏ hàng từ MongoDB:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể tải giỏ hàng.'
        });
    }
}

// PUT /api/cart - Lưu giỏ hàng của user đang đăng nhập xuống collection Cart
async function updateCart(req, res) {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        await Cart.saveByUser(
            req.userId,
            { email: user.email, fullName: user.fullName },
            items
        );

        res.json({
            success: true,
            items
        });
    } catch (err) {
        console.error('Lỗi lưu giỏ hàng xuống MongoDB:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể lưu giỏ hàng.'
        });
    }
}

module.exports = {
    getCart,
    updateCart
};

