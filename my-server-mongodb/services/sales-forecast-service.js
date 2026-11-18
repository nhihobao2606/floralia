const Product = require('../models/product');
const Order = require('../models/order');

const HISTORY_MONTH_COUNT = 24;
const DISPLAY_MONTH_COUNT = 6;
const MODEL_LAGS = 6;
const MAX_REASONABLE_QUANTITY = 1_000_000;

function nonNegativeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_REASONABLE_QUANTITY) : 0;
}

function safeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1_000_000_000_000) : 0;
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getStock(product) {
    if (Array.isArray(product.variants) && product.variants.length) {
        return product.variants.reduce((total, variant) => total + nonNegativeNumber(variant?.stock), 0);
    }
    return nonNegativeNumber(product.stock);
}

function weightedAverage(values) {
    const recent = values.slice(-MODEL_LAGS);
    const weightTotal = recent.reduce((sum, _, index) => sum + index + 1, 0);
    return weightTotal ? recent.reduce((sum, value, index) => sum + value * (index + 1), 0) / weightTotal : 0;
}

function makeFeatures(values, targetMonth) {
    const recent = values.slice(-MODEL_LAGS);
    const lags = recent.map(value => Math.log1p(Math.max(0, value)));
    while (lags.length < MODEL_LAGS) lags.unshift(0);
    const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const recentThree = recent.slice(-3);
    const previousThree = recent.slice(-6, -3);
    const angle = (targetMonth % 12) * Math.PI / 6;
    return [
        ...lags,
        Math.log1p(mean(recentThree)),
        Math.log1p(mean(recent)),
        Math.log1p(mean(recentThree)) - Math.log1p(mean(previousThree)),
        Math.sin(angle),
        Math.cos(angle)
    ];
}

function trainDemandModel(seriesByProduct, firstMonth) {
    const samples = [];
    for (const series of seriesByProduct) {
        // The current month is incomplete, so it is used as a feature but not a training target.
        for (let targetIndex = MODEL_LAGS; targetIndex < series.length - 1; targetIndex++) {
            samples.push({
                features: makeFeatures(series.slice(0, targetIndex), (firstMonth + targetIndex) % 12),
                target: Math.log1p(series[targetIndex]),
                validation: targetIndex === series.length - 2
            });
        }
    }

    const training = samples.filter(sample => !sample.validation);
    const validation = samples.filter(sample => sample.validation);
    if (!training.length) {
        return { predict: values => weightedAverage(values), samples: 0, mae: null, fallback: true };
    }

    const featureCount = training[0].features.length;
    const means = Array(featureCount).fill(0);
    const variances = Array(featureCount).fill(0);
    for (const sample of training) {
        sample.features.forEach((value, index) => { means[index] += value / training.length; });
    }
    for (const sample of training) {
        sample.features.forEach((value, index) => { variances[index] += ((value - means[index]) ** 2) / training.length; });
    }
    const scales = variances.map(value => Math.sqrt(value) || 1);
    const encode = features => [1, ...features.map((value, index) => (value - means[index]) / scales[index])];
    const encodedTraining = training.map(sample => ({ x: encode(sample.features), y: sample.target }));
    const weights = Array(featureCount + 1).fill(0);
    const learningRate = 0.035;
    const regularization = 0.01;

    for (let epoch = 0; epoch < 500; epoch++) {
        const gradients = Array(weights.length).fill(0);
        for (const sample of encodedTraining) {
            const error = weights.reduce((sum, weight, index) => sum + weight * sample.x[index], 0) - sample.y;
            sample.x.forEach((value, index) => { gradients[index] += error * value / encodedTraining.length; });
        }
        for (let index = 0; index < weights.length; index++) {
            weights[index] -= learningRate * (gradients[index] + (index ? regularization * weights[index] : 0));
        }
    }

    const predict = (values, targetMonth) => {
        const encoded = encode(makeFeatures(values, targetMonth));
        const predictedLogDemand = weights.reduce((sum, weight, index) => sum + weight * encoded[index], 0);
        return Math.min(
            MAX_REASONABLE_QUANTITY,
            Math.max(0, Math.expm1(Math.min(Math.log1p(MAX_REASONABLE_QUANTITY), predictedLogDemand)))
        );
    };
    const mae = validation.length
        ? validation.reduce((sum, sample) => {
            const predictedLogDemand = weights.reduce((total, weight, index) => total + weight * encode(sample.features)[index], 0);
            return sum + Math.abs(Math.expm1(predictedLogDemand) - Math.expm1(sample.target));
        }, 0) / validation.length
        : null;

    return { predict, samples: training.length, mae, fallback: false };
}

async function getForecast() {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - (HISTORY_MONTH_COUNT - 1), 1);
    const [ordersResult, productsResult] = await Promise.all([
        Order.getDemandHistory(firstMonth),
        Product.getAll()
    ]);
    const orders = Array.isArray(ordersResult) ? ordersResult.filter(order => order && typeof order === 'object') : [];
    const products = Array.isArray(productsResult)
        ? productsResult.filter(product => product && typeof product === 'object' && String(product.sku || '').trim())
        : [];
    const monthDates = Array.from({ length: HISTORY_MONTH_COUNT }, (_, index) =>
        new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
    );
    const salesBySku = new Map();

    for (const order of orders) {
        const date = new Date(order.createdAt);
        if (!Number.isFinite(date.getTime())) continue;
        const key = monthKey(date);
        for (const item of Array.isArray(order.items) ? order.items : []) {
            if (!item || typeof item !== 'object') continue;
            const sku = String(item.sku || '').trim();
            if (!sku) continue;
            const monthly = salesBySku.get(sku) || new Map();
            const bucket = monthly.get(key) || { quantity: 0, revenue: 0, pricedQuantity: 0 };
            const quantity = nonNegativeNumber(item.quantity);
            const price = safeMoney(item.salePrice ?? item.price);
            bucket.quantity += quantity;
            if (price > 0 && quantity > 0) {
                bucket.revenue += price * quantity;
                bucket.pricedQuantity += quantity;
            }
            monthly.set(key, bucket);
            salesBySku.set(sku, monthly);
        }
    }

    const productBySku = new Map();
    for (const product of products) {
        productBySku.set(String(product.sku).trim(), product);
        for (const variant of Array.isArray(product.variants) ? product.variants : []) {
            if (variant?.sku) productBySku.set(String(variant.sku).trim(), product);
        }
    }
    const monthlyByProduct = new Map();
    for (const [sku, monthly] of salesBySku) {
        const product = productBySku.get(sku);
        if (!product) continue;
        const baseSku = String(product.sku);
        const values = monthlyByProduct.get(baseSku) || new Map();
        for (const [key, sale] of monthly) {
            const bucket = values.get(key) || { quantity: 0, revenue: 0, pricedQuantity: 0 };
            bucket.quantity += sale.quantity;
            bucket.revenue += sale.revenue;
            bucket.pricedQuantity += sale.pricedQuantity;
            values.set(key, bucket);
        }
        monthlyByProduct.set(baseSku, values);
    }

    const productSeries = products.map(product => {
        const history = monthlyByProduct.get(String(product.sku)) || new Map();
        const values = monthDates.map(date => history.get(monthKey(date))?.quantity || 0);
        const currentMonthIndex = values.length - 1;
        if (values[currentMonthIndex] > 0) {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            values[currentMonthIndex] *= daysInMonth / Math.max(1, now.getDate());
        }
        return { product, history, values };
    });

    const demandModel = trainDemandModel(productSeries.map(item => item.values), monthDates[0].getMonth());
    const nextMonth = (monthDates[0].getMonth() + monthDates.length) % 12;
    const rows = productSeries.map(({ product, history, values }) => {
        const modelEstimate = demandModel.predict(values, nextMonth);
        const recentBaseline = weightedAverage(values.slice(-DISPLAY_MONTH_COUNT));
        const blendedEstimate = modelEstimate * 0.4 + recentBaseline * 0.6;
        const hasRecentDemand = values.slice(-DISPLAY_MONTH_COUNT).some(value => value > 0);
        const forecastQuantity = hasRecentDemand
            ? Math.max(1, Math.round(blendedEstimate))
            : Math.round(blendedEstimate);
        const monthlySales = monthDates.slice(-DISPLAY_MONTH_COUNT).map(date => ({
            month: monthKey(date),
            quantity: history.get(monthKey(date))?.quantity || 0
        }));
        const stock = getStock(product);
        const historicalRevenue = monthDates.reduce((sum, date) => sum + (history.get(monthKey(date))?.revenue || 0), 0);
        const pricedUnits = monthDates.reduce((sum, date) => sum + (history.get(monthKey(date))?.pricedQuantity || 0), 0);
        const fallbackPrice = safeMoney(product.price || product.minPrice);
        const estimatedUnitRevenue = pricedUnits > 0 ? historicalRevenue / pricedUnits : fallbackPrice;
        const monthsWithSales = values.filter(value => value > 0).length;
        const confidence = monthsWithSales >= 4 ? 'Cao' : monthsWithSales >= 2 ? 'Trung bình' : 'Thấp';
        let stockStatus = 'Cân bằng';
        if (forecastQuantity > stock) stockStatus = 'Có nguy cơ thiếu';
        else if (forecastQuantity > 0 && stock > forecastQuantity * 3) stockStatus = 'Tồn kho cao';
        else if (monthsWithSales < 2) stockStatus = 'Ít dữ liệu';
        return {
            sku: String(product.sku),
            name: product.name || product.title || String(product.sku),
            category: product.category || '',
            price: fallbackPrice,
            estimatedUnitRevenue,
            stock,
            monthlySales,
            forecastQuantity,
            forecastRevenue: Math.min(1_000_000_000_000_000, forecastQuantity * estimatedUnitRevenue),
            method: demandModel.fallback ? 'Weighted average fallback (insufficient training data)' : 'Global Ridge Regression',
            confidence,
            stockStatus,
            averageMonthlySales: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        };
    }).sort((left, right) => right.forecastQuantity - left.forecastQuantity || right.averageMonthlySales - left.averageMonthlySales);

    return {
        generatedAt: now.toISOString(),
        forecastMonth: monthKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)),
        historyMonths: monthDates.slice(-DISPLAY_MONTH_COUNT).map(monthKey),
        trainingOrders: orders.length,
        model: demandModel.fallback
            ? 'Weighted average fallback (insufficient training samples)'
            : 'Global Ridge Regression trained with batch gradient descent on log demand',
        trainingSamples: demandModel.samples,
        validationMae: demandModel.mae,
        products: rows,
        summary: {
            expectedUnits: rows.reduce((sum, row) => sum + row.forecastQuantity, 0),
            expectedRevenue: rows.reduce((sum, row) => sum + row.forecastRevenue, 0),
            shortageProducts: rows.filter(row => row.stockStatus === 'Có nguy cơ thiếu').length,
            highStockProducts: rows.filter(row => row.stockStatus === 'Tồn kho cao').length
        }
    };
}

module.exports = { getForecast };
