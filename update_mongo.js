require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateUsers() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
    console.log(`Connecting to MongoDB using URI: ${MONGO_URI}`);
    
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db('pwa_cashier');
        const result = await db.collection('users').updateMany(
            {},
            { $set: { location: "S0001" } }
        );
        console.log(`Successfully updated ${result.modifiedCount} users in MongoDB.`);
    } catch (err) {
        console.error('MongoDB error:', err);
    } finally {
        await client.close();
    }
}

updateUsers();
