
require('dotenv').config();
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);

async function main() {
  try {
    await client.connect();

    const db = client.db(process.env.DB_NAME);
    await db.command({ ping: 1 });

    console.log('Ket noi MongoDB Atlas thanh cong!');
    console.log('Database:', db.databaseName);
  } catch (error) {
    console.error('Loi ket noi:', error.message);
  } finally {
    await client.close();
  }
}

main();
