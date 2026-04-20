import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = process.env.MONGODB_DB_NAME || 'marketplace';
let client;
let db;

const collections = {
  users: 'users',
  items: 'items',
  messages: 'messages'
};

const readSeedFile = (filename) => {
  try {
    const filePath = join(__dirname, '../data', filename);
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed reading seed file ${filename}:`, error.message);
    return [];
  }
};

const removeMongoId = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
};

const seedIfEmpty = async (name, filename) => {
  const collection = db.collection(name);
  const count = await collection.countDocuments();
  if (count > 0) return;

  const seed = readSeedFile(filename);
  if (!seed.length) return;
  await collection.insertMany(seed, { ordered: false });
  console.log(`Seeded ${seed.length} records into ${name}`);
};

export const connectToDatabase = async () => {
  if (db) return db;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI is required. Create a .env file in server/ with MONGODB_URI and restart.'
    );
  }

  if (!client) {
    client = new MongoClient(mongoUri);
  }

  await client.connect();
  db = client.db(DB_NAME);

  await Promise.all([
    seedIfEmpty(collections.users, 'users.json'),
    seedIfEmpty(collections.items, 'items.json'),
    seedIfEmpty(collections.messages, 'messages.json')
  ]);

  console.log(`Connected to MongoDB database "${DB_NAME}"`);
  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase() first.');
  }
  return db;
};

export const getCollection = (name) => getDb().collection(name);
export { collections, removeMongoId };
