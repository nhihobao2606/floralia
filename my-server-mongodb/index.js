const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const User = require('./models/user');
const Product = require('./models/product');
const Blog = require('./models/blog');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const addressRoutes = require('./routes/addressRoutes');
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const port = process.env.PORT || 3002;

app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.send('Floralia Web Server is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/blogs', blogRoutes);

async function startServer() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Thiếu MONGODB_URI trong file .env.');
    }
    if (!process.env.JWT_SECRET?.trim()) {
        throw new Error('Thiếu JWT_SECRET trong file .env.');
    }

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || 'FloraliaTea');

        User.setCollection(db.collection('Users'));
        Product.setCollections(
            db.collection('Product'),
            db.collection('ProductAssets'),
            db.collection('Reviews')
        );
        Blog.setCollection(db.collection('Blogs'));

        await db.collection('Users').createIndex({ email: 1 }, { unique: true });
        await db.collection('ProductAssets').createIndex({ assetId: 1 });
        await db.collection('ProductAssets').createIndex({ originalFileName: 1 });
        await db.command({ ping: 1 });

        app.listen(port, () => {
            console.log('Floralia server connected to MongoDB (' + db.databaseName + ') and listening on port ' + port);
        });

        process.once('SIGINT', async () => {
            await client.close();
            process.exit(0);
        });
        process.once('SIGTERM', async () => {
            await client.close();
            process.exit(0);
        });
    } catch (error) {
        console.error('Không thể khởi động server:', error);
        await client.close().catch((closeError) => {
            console.error('Không thể đóng kết nối MongoDB:', closeError);
        });
        process.exitCode = 1;
    }
}

startServer();
