const Voucher = require('../models/voucher');

async function validateVoucher(req, res) {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const subtotal = Number(req.body?.subtotal);
    if (!code || !Number.isFinite(subtotal) || subtotal <= 0) {
        return res.status(400).json({ success: false, message: 'Mã voucher hoặc giá trị đơn hàng không hợp lệ.' });
    }

    try {
        const voucher = await Voucher.getByCode(code);
        const discount = Voucher.calculateDiscount(voucher, subtotal);
        if (discount === null || discount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã voucher không hợp lệ, chưa đến hạn, đã hết hạn hoặc chưa đủ điều kiện.'
            });
        }

        res.json({
            success: true,
            voucher: { code: voucher.code, discount }
        });
    } catch (error) {
        console.error('Lỗi kiểm tra voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể kiểm tra voucher từ MongoDB.' });
    }
}

module.exports = { validateVoucher };
