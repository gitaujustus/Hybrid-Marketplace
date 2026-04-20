import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections, getCollection, removeMongoId } from '../src/db.js';

const router = express.Router();

const normalizeMpesaNumber = (rawPhone) => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^254(7|1)\d{8}$/.test(digits)) {
    return digits;
  }
  return null;
};

// Get all items for a specific seller (used for "My Listings")
router.get('/user/:sellerId', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    const items = await itemsCollection
      .find({ sellerId: req.params.sellerId })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items.map(removeMongoId));
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ error: 'Failed to fetch user items' });
  }
});

// Get all active items (with search)
router.get('/', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    const { search } = req.query;
    const query = {
      $or: [{ status: 'active' }, { status: { $exists: false } }]
    };

    if (search?.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and = [
        {
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } }
          ]
        }
      ];
    }

    const items = await itemsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json(items.map(removeMongoId));
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    const item = await itemsCollection.findOne({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(removeMongoId(item));
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create new item listing
router.post('/', async (req, res) => {
  try {
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
    
    const itemsCollection = getCollection(collections.items);
    await itemsCollection.insertOne(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item
router.put('/:id', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    const existing = await itemsCollection.findOne({ id: req.params.id });
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const nextItem = { ...existing, ...req.body };
    await itemsCollection.updateOne(
      { id: req.params.id },
      { $set: nextItem }
    );
    res.json(removeMongoId(nextItem));
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item (remove from marketplace)
router.delete('/:id', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    await itemsCollection.deleteOne({ id: req.params.id });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Checkout - buyer confirms payment
router.post('/:id/checkout', async (req, res) => {
  try {
    const { buyerId, mpesaNumber, amount } = req.body || {};
    if (!buyerId) {
      return res.status(400).json({ error: 'buyerId is required' });
    }

    const normalizedMpesa = normalizeMpesaNumber(mpesaNumber);
    if (!normalizedMpesa) {
      return res.status(400).json({ error: 'Valid M-Pesa number is required' });
    }

    const itemsCollection = getCollection(collections.items);
    const item = await itemsCollection.findOne({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (item.sellerId === buyerId) {
      return res.status(400).json({ error: 'Seller cannot pay for own listing' });
    }

    const expectedAmount =
      item.acceptedOffer && item.acceptedBuyerId === buyerId
        ? Number(item.acceptedOffer)
        : Number(item.price);
    const paidAmount = Number(amount);
    if (!paidAmount || paidAmount !== expectedAmount) {
      return res.status(400).json({
        error: `Payment amount must be ${expectedAmount} for this transaction`
      });
    }

    const update = {
      paymentStatus: 'paid',
      paymentConfirmedBy: buyerId,
      paymentConfirmedAt: new Date().toISOString(),
      paymentAmount: paidAmount,
      paymentMpesaNumber: normalizedMpesa
    };
    await itemsCollection.updateOne({ id: req.params.id }, { $set: update });
    const updatedItem = { ...item, ...update };
    
    res.json({ 
      success: true, 
      message: 'Payment confirmed successfully',
      item: removeMongoId(updatedItem)
    });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ error: 'Failed to process checkout' });
  }
});

// Seller confirms payment and removes item
router.post('/:id/confirm-sale', async (req, res) => {
  try {
    const itemsCollection = getCollection(collections.items);
    const item = await itemsCollection.findOne({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await itemsCollection.deleteOne({ id: req.params.id });
    
    res.json({ 
      success: true, 
      message: 'Item sold and removed from marketplace',
      item: removeMongoId(item)
    });
  } catch (error) {
    console.error('Error confirming sale:', error);
    res.status(500).json({ error: 'Failed to confirm sale' });
  }
});

export default router;