const Recommendations = require('../services/product-recommendation-service');
const SalesForecast = require('../services/sales-forecast-service');

async function getSalesForecast(req, res) {
    try {
        const forecast = await SalesForecast.getForecast();
        res.set('Cache-Control', 'private, no-store');
        res.json({ success: true, ...forecast });
    } catch (error) {
        console.error('Could not build admin sales forecast:', error);
        res.status(500).json({ success: false, message: 'Không thể tạo dự báo doanh số.' });
    }
}

async function getAdminRecommendations(req, res) {
    const startedAt = Date.now();
    console.info('[recommendations] Admin overview requested');
    try {
        const data = await Recommendations.getAdminData();
        console.info(`[recommendations] Admin overview ready in ${Date.now() - startedAt}ms`);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error(`[recommendations] Admin overview failed after ${Date.now() - startedAt}ms`, error);
        console.error('Lỗi tải phân khúc gợi ý sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể tải dữ liệu gợi ý sản phẩm.' });
    }
}

async function saveSegmentRecommendations(req, res) {
    try {
        const productSkus = await Recommendations.saveSegment(req.params.segmentId, req.body.productSkus);
        res.json({ success: true, productSkus });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Không thể lưu gợi ý sản phẩm.' });
    }
}

async function getCustomerRecommendations(req, res) {
    try {
        const result = await Recommendations.getForCustomer(req.authenticatedUser || null, req.query.visitorId);
        res.set('Cache-Control', 'private, no-store');
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Lỗi tạo gợi ý sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể tải gợi ý sản phẩm.' });
    }
}

async function trackProductView(req, res) {
    try {
        const tracked = await Recommendations.recordProductView(
            req.authenticatedUser || null,
            req.body?.visitorId,
            req.body?.sku
        );
        res.status(tracked ? 202 : 400).json({ success: tracked });
    } catch (error) {
        console.error('Lỗi lưu lượt xem sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể lưu lượt xem sản phẩm.' });
    }
}

function streamRecommendationEvents(req, res) {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ action: 'connected' })}\n\n`);
    const onUpdated = payload => res.write(`data: ${JSON.stringify(payload)}\n\n`);
    Recommendations.recommendationEvents.on('updated', onUpdated);
    req.on('close', () => Recommendations.recommendationEvents.off('updated', onUpdated));
}

module.exports = { getAdminRecommendations, saveSegmentRecommendations, getCustomerRecommendations, trackProductView, streamRecommendationEvents, getSalesForecast };
