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

//  View Engine
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

//  Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

//  Data Directory Setup (for local seed files)
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
['items.json', 'users.json', 'messages.json'].forEach(file => {
  const filePath = join(dataDir, file);
  if (!existsSync(filePath)) writeFileSync(filePath, '[]');
});

//  Page Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Authentication page
app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
// User's listings page
app.get('/my-listings', (req, res) => res.render('mylistings'));
app.get('/add-listing', (req, res) => res.render('add-listing'));
app.get('/items/:id', (req, res) => res.render('item-detail', { itemId: req.params.id }));

// Messages page
app.get('/messages', (req, res) => res.render('messages'));

//  API Routes─
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

//  Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

//  Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

//  Start local server only (Vercel handles serverless runtime)
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







// import express from 'express';
// import cors from 'cors';
// import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';
// import itemsRouter from './routes/items.js';
// import usersRouter from './routes/users.js';
// import messagesRouter from './routes/messages.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const app = express();
// const PORT = process.env.PORT || 3000;

// // View engine and static assets
// app.set('view engine', 'ejs');
// app.set('views', join(__dirname, 'views'));
// app.use(express.static(join(__dirname, 'public')));

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Ensure data directory exists
// const dataDir = join(__dirname, 'data');
// if (!existsSync(dataDir)) {
//   mkdirSync(dataDir, { recursive: true });
// }

// const ensureJsonDataFile = (filePath, sampleData) => {
//   let shouldWrite = false;

//   if (!existsSync(filePath)) {
//     shouldWrite = true;
//   } else {
//     try {
//       const contents = readFileSync(filePath, 'utf8').trim();
//       if (!contents) {
//         shouldWrite = true;
//       } else {
//         const parsed = JSON.parse(contents);
//         if (!Array.isArray(parsed) || parsed.length === 0) {
//           shouldWrite = true;
//         }
//       }
//     } catch (error) {
//       shouldWrite = true;
//     }
//   }

//   if (shouldWrite) {
//     writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
//   }
// };

// // Initialize data files with sample data
// const initDataFiles = () => {
//   // Items data
//   const itemsPath = join(dataDir, 'items.json');
//   ensureJsonDataFile(itemsPath, [
//     {
//       id: '1',
//       name: 'Vintage Comic Book - Spider-Man #1',
//       description: 'Rare collectible comic in mint condition, never opened',
//       price: 500,
//       image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=400',
//       sellerId: 'user1',
//       sellerName: 'ComicCollector',
//       status: 'active',
//       highestOffer: null,
//       highestOfferBuyer: null,
//       createdAt: new Date().toISOString()
//     },
//     {
//       id: '2',
//       name: 'Limited Edition Funko Pop - Batman',
//       description: 'Rare convention exclusive, still in original box',
//       price: 150,
//       image: 'https://images.unsplash.com/photo-1581235725079-7c7783e6a2df?w=400',
//       sellerId: 'user2',
//       sellerName: 'ToyTrader',
//       status: 'active',
//       highestOffer: null,
//       highestOfferBuyer: null,
//       createdAt: new Date().toISOString()
//     },
//     {
//       id: '3',
//       name: 'Pokemon Card - Charizard Holo',
//       description: 'First edition, graded PSA 9, extremely rare',
//       price: 1200,
//       image: 'https://images.unsplash.com/photo-1621274403997-37aace184f49?w=400',
//       sellerId: 'user3',
//       sellerName: 'CardMaster',
//       status: 'active',
//       highestOffer: null,
//       highestOfferBuyer: null,
//       createdAt: new Date().toISOString()
//     },
//     {
//       id: '4',
//       name: 'Star Wars Action Figure - Darth Vader',
//       description: '1977 original, still in packaging',
//       price: 850,
//       image: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf4f2?w=400',
//       sellerId: 'user1',
//       sellerName: 'ComicCollector',
//       status: 'active',
//       highestOffer: null,
//       highestOfferBuyer: null,
//       createdAt: new Date().toISOString()
//     },
//     {
//       id: '5',
//       name: 'Magic: The Gathering - Black Lotus',
//       description: 'Limited edition, near mint condition',
//       price: 3000,
//       image: 'https://images.unsplash.com/photo-1616901826816-7045fc2e8a8d?w=400',
//       sellerId: 'user2',
//       sellerName: 'ToyTrader',
//       status: 'active',
//       highestOffer: null,
//       highestOfferBuyer: null,
//       createdAt: new Date().toISOString()
//     }
//   ]);

//   // Users data
//   const usersPath = join(dataDir, 'users.json');
//   ensureJsonDataFile(usersPath, [
//     { id: 'user1', name: 'ComicCollector', createdAt: new Date().toISOString() },
//     { id: 'user2', name: 'ToyTrader', createdAt: new Date().toISOString() },
//     { id: 'user3', name: 'CardMaster', createdAt: new Date().toISOString() }
//   ]);

//   // Messages data
//   const messagesPath = join(dataDir, 'messages.json');
//   ensureJsonDataFile(messagesPath, [
//     {
//       id: 'msg1',
//       itemId: '1',
//       senderId: 'user2',
//       senderName: 'ToyTrader',
//       content: 'Is this comic still available?',
//       type: 'text',
//       timestamp: new Date(Date.now() - 86400000).toISOString()
//     },
//     {
//       id: 'msg2',
//       itemId: '1',
//       senderId: 'user1',
//       senderName: 'ComicCollector',
//       content: 'Yes, it is! Interested?',
//       type: 'text',
//       timestamp: new Date(Date.now() - 86000000).toISOString()
//     },
//     {
//       id: 'msg3',
//       itemId: '1',
//       senderId: 'user2',
//       senderName: 'ToyTrader',
//       content: '450',
//       type: 'offer',
//       price: 450,
//       originalPrice: 500,
//       status: 'pending',
//       timestamp: new Date(Date.now() - 85000000).toISOString()
//     }
//   ]);
// };

// initDataFiles();

// // Server-rendered pages
// app.get('/', (req, res) => {
//   res.render('index');
// });

// // API routes
// app.use('/api/items', itemsRouter);
// app.use('/api/users', usersRouter);
// app.use('/api/messages', messagesRouter);

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({ status: 'OK', timestamp: new Date().toISOString() });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Something went wrong!' });
// });

// app.listen(PORT, () => {
//   console.log(`Server running`);
//   console.log(`Data directory: ${dataDir}`);
//   console.log(`Health check`);
// });