import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import itemsRouter from './routes/items.js';
import usersRouter from './routes/users.js';
import messagesRouter from './routes/messages.js';
import { connectToDatabase } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
['items.json', 'users.json', 'messages.json'].forEach(file => {
  const filePath = join(dataDir, file);
  if (!existsSync(filePath)) writeFileSync(filePath, '[]');
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/my-listings', (req, res) => res.render('mylistings'));
app.get('/add-listing', (req, res) => res.render('add-listing'));
app.get('/items/:id', (req, res) => res.render('item-detail', { itemId: req.params.id }));
app.get('/messages', (req, res) => res.render('messages'));

let dbReadyPromise = null;
const ensureDbConnection = async () => {
  if (!dbReadyPromise) {
    dbReadyPromise = connectToDatabase().catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }
  return dbReadyPromise;
};

app.use('/api', async (req, res, next) => {
  try {
    await ensureDbConnection();
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.use('/api/items', itemsRouter);
app.use('/api/users', usersRouter);
app.use('/api/messages', messagesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

if (!process.env.VERCEL) {
  const startServer = async () => {
    await ensureDbConnection();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };

  startServer().catch((error) => {
    console.error('Failed to start server:', error);
  });
}


export default app;