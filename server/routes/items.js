import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const itemsPath = join(__dirname, '../data/items.json');
const messagesPath = join(__dirname, '../data/messages.json');

const readItems = () => {
  const data = readFileSync(itemsPath);
  return JSON.parse(data);
};

const writeItems = (items) => {
  writeFileSync(itemsPath, JSON.stringify(items, null, 2));
};

const readMessages = () => {
  const data = readFileSync(messagesPath);
  return JSON.parse(data);
};

// Get all active items (with search)
router.get('/', (req, res) => {
  try {
    let items = readItems();
    // Only show active items
    items = items.filter(item => item.status === 'active');
    
    const { search } = req.query;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort by newest first
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get single item
router.get('/:id', (req, res) => {
  try {
    const items = readItems();
    const item = items.find(i => i.id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create new item listing
router.post('/', (req, res) => {
  try {
    const items = readItems();
    const { name, description, price, image, sellerId, sellerName } = req.body;
    
    if (!name || !price || !sellerId) {
      return res.status(400).json({ error: 'Name, price, and sellerId are required' });
    }
    
    const newItem = {
      id: uuidv4(),
      name,
      description: description || 'No description provided',
      price: parseFloat(price),
      image: image || 'https://via.placeholder.com/400x300?text=Collectible+Item',
      sellerId,
      sellerName: sellerName || 'Anonymous',
      status: 'active',
      highestOffer: null,
      highestOfferBuyer: null,
      createdAt: new Date().toISOString()
    };
    
    items.push(newItem);
    writeItems(items);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item
router.put('/:id', (req, res) => {
  try {
    const items = readItems();
    const index = items.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    items[index] = { ...items[index], ...req.body };
    writeItems(items);
    res.json(items[index]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item (remove from marketplace)
router.delete('/:id', (req, res) => {
  try {
    const items = readItems();
    const filtered = items.filter(i => i.id !== req.params.id);
    writeItems(filtered);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Checkout - buyer confirms payment
router.post('/:id/checkout', (req, res) => {
  try {
    const items = readItems();
    const index = items.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    items[index].paymentStatus = 'paid';
    items[index].paymentConfirmedBy = req.body.buyerId;
    items[index].paymentConfirmedAt = new Date().toISOString();
    writeItems(items);
    
    res.json({ 
      success: true, 
      message: 'Payment confirmed, awaiting seller confirmation',
      item: items[index]
    });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ error: 'Failed to process checkout' });
  }
});

// Seller confirms payment and removes item
router.post('/:id/confirm-sale', (req, res) => {
  try {
    const items = readItems();
    const index = items.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Remove item from marketplace
    const soldItem = items[index];
    items.splice(index, 1);
    writeItems(items);
    
    res.json({ 
      success: true, 
      message: 'Item sold and removed from marketplace',
      item: soldItem
    });
  } catch (error) {
    console.error('Error confirming sale:', error);
    res.status(500).json({ error: 'Failed to confirm sale' });
  }
});

export default router;