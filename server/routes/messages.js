import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { collections, getCollection, removeMongoId } from '../src/db.js';

const router = express.Router();

const buildThreadId = (itemId, userA, userB) => {
  const [first, second] = [userA, userB].sort();
  return `${itemId}:${first}:${second}`;
};

// Get conversation summaries for a user (inbox)
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId } = req.query;
    const messagesCollection = getCollection(collections.messages);
    const itemsCollection = getCollection(collections.items);
    const messages = await messagesCollection.find({}).sort({ timestamp: 1 }).toArray();
    const items = await itemsCollection.find({}).toArray();
    const itemById = new Map(items.map(item => [item.id, item]));

    const relevantMessages = messages.filter(msg => {
      const isParticipant = msg.senderId === userId || msg.receiverId === userId;
      const matchesItem = !itemId || msg.itemId === itemId;
      return isParticipant && matchesItem;
    });

    const byThread = new Map();
    relevantMessages.forEach(msg => {
      const existing = byThread.get(msg.threadId);
      const unreadIncrement = msg.receiverId === userId && !msg.readBy?.includes(userId) ? 1 : 0;
      if (!existing) {
        const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const firstOtherMessage = relevantMessages.find(
          entry => entry.threadId === msg.threadId && entry.senderId !== userId
        );
        const otherUserName = firstOtherMessage?.senderName || 'Buyer/Seller';
        byThread.set(msg.threadId, {
          threadId: msg.threadId,
          itemId: msg.itemId,
          itemName: itemById.get(msg.itemId)?.name || 'Unknown item',
          itemImage: itemById.get(msg.itemId)?.image || '',
          otherUserId,
          otherUserName,
          lastMessage: msg,
          unreadCount: unreadIncrement
        });
      } else {
        existing.lastMessage = msg;
        existing.unreadCount += unreadIncrement;
      }
    });

    const conversations = [...byThread.values()].sort(
      (a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    );

    res.json(conversations.map(conv => removeMongoId(conv)));
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get thread messages for a specific item and 2 participants
router.get('/thread', async (req, res) => {
  try {
    const { itemId, userId, otherUserId, since } = req.query;

    if (!itemId || !userId || !otherUserId) {
      return res.status(400).json({ error: 'itemId, userId, and otherUserId are required' });
    }

    const messagesCollection = getCollection(collections.messages);
    const threadId = buildThreadId(itemId, userId, otherUserId);
    const sinceDate = since ? new Date(since) : null;

    if (since && isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid "since" timestamp format' });
    }

    const query = { threadId };
    if (sinceDate) query.timestamp = { $gt: sinceDate.toISOString() };
    const threadMessages = await messagesCollection.find(query).sort({ timestamp: 1 }).toArray();

    await messagesCollection.updateMany(
      {
        threadId,
        receiverId: userId,
        $or: [{ readBy: { $exists: false } }, { readBy: { $nin: [userId] } }]
      },
      { $addToSet: { readBy: userId } }
    );

    const lastTimestamp = threadMessages.length
      ? threadMessages[threadMessages.length - 1].timestamp
      : since || null;

    res.json({
      threadId,
      messages: threadMessages.map(removeMongoId),
      lastTimestamp,
      hasNew: threadMessages.length > 0,
      pollAgainAfter: 2000
    });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    res.status(500).json({ error: 'Failed to fetch thread messages' });
  }
});

// Send a message or offer in a thread
router.post('/thread/message', async (req, res) => {
  try {
    const {
      itemId,
      senderId,
      senderName,
      receiverId,
      content,
      type = 'text',
      offerAmount
    } = req.body;

    if (!itemId || !senderId || !receiverId || !senderName) {
      return res.status(400).json({ error: 'itemId, senderId, senderName, and receiverId are required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Sender and receiver cannot be the same user' });
    }

    if (type === 'text' && (!content || !String(content).trim())) {
      return res.status(400).json({ error: 'Text message content is required' });
    }

    if (type === 'offer') {
      const numericOffer = Number(offerAmount);
      if (!numericOffer || numericOffer <= 0) {
        return res.status(400).json({ error: 'A valid offerAmount is required for offer messages' });
      }
    }

    const itemsCollection = getCollection(collections.items);
    const messagesCollection = getCollection(collections.messages);
    const item = await itemsCollection.findOne({ id: itemId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const now = new Date().toISOString();
    const threadId = buildThreadId(itemId, senderId, receiverId);

    const newMessage = {
      id: uuidv4(),
      threadId,
      itemId,
      senderId,
      senderName,
      receiverId,
      content: type === 'text' ? String(content).trim() : '',
      type,
      timestamp: now,
      readBy: [senderId]
    };

    if (type === 'offer') {
      const numericOffer = Number(offerAmount);
      newMessage.offerAmount = numericOffer;
      newMessage.offerStatus = 'pending';
      await itemsCollection.updateOne(
        { id: itemId },
        {
          $set: {
            highestOffer: Math.max(item.highestOffer || 0, numericOffer),
            highestOfferBuyer: senderId
          }
        }
      );
    }

    await messagesCollection.insertOne(newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating thread message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Handle offer actions: accept, reject, counter
router.post('/offers/:id/action', async (req, res) => {
  try {
    const { action, userId, userName, counterAmount } = req.body;
    const validActions = ['accept', 'reject', 'counter'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use accept, reject, or counter' });
    }

    const messagesCollection = getCollection(collections.messages);
    const itemsCollection = getCollection(collections.items);
    const offerMessage = await messagesCollection.findOne({ id: req.params.id });
    if (!offerMessage) {
      return res.status(404).json({ error: 'Offer message not found' });
    }
    if (offerMessage.type !== 'offer') {
      return res.status(400).json({ error: 'Only offer messages can be acted on' });
    }

    if (offerMessage.offerStatus !== 'pending') {
      return res.status(400).json({ error: `Offer is already ${offerMessage.offerStatus}` });
    }

    if (!userId || userId === offerMessage.senderId) {
      return res.status(403).json({ error: 'Only the receiver can act on this offer' });
    }

    if (action === 'counter') {
      const numericCounter = Number(counterAmount);
      if (!numericCounter || numericCounter <= 0) {
        return res.status(400).json({ error: 'Valid counterAmount is required for counter action' });
      }

      offerMessage.offerStatus = 'countered';
      offerMessage.respondedAt = new Date().toISOString();
      offerMessage.respondedBy = userId;

      const counterMessage = {
        id: uuidv4(),
        threadId: offerMessage.threadId,
        itemId: offerMessage.itemId,
        senderId: userId,
        senderName: userName || 'User',
        receiverId: offerMessage.senderId,
        content: '',
        type: 'offer',
        offerAmount: numericCounter,
        offerStatus: 'pending',
        timestamp: new Date().toISOString(),
        readBy: [userId]
      };
      const item = await itemsCollection.findOne({ id: offerMessage.itemId });
      if (item) {
        await itemsCollection.updateOne(
          { id: offerMessage.itemId },
          {
            $set: {
              highestOffer: Math.max(item.highestOffer || 0, numericCounter),
              highestOfferBuyer: userId
            }
          }
        );
      }

      await messagesCollection.updateOne(
        { id: offerMessage.id },
        { $set: { offerStatus: offerMessage.offerStatus, respondedAt: offerMessage.respondedAt, respondedBy: offerMessage.respondedBy } }
      );
      await messagesCollection.insertOne(counterMessage);
      return res.json({
        success: true,
        action,
        originalOffer: removeMongoId(offerMessage),
        counterOffer: counterMessage
      });
    }

    offerMessage.offerStatus = action === 'accept' ? 'accepted' : 'rejected';
    offerMessage.respondedAt = new Date().toISOString();
    offerMessage.respondedBy = userId;

    if (action === 'accept') {
      const item = await itemsCollection.findOne({ id: offerMessage.itemId });
      if (item) {
        await itemsCollection.updateOne(
          { id: offerMessage.itemId },
          {
            $set: {
              status: 'reserved',
              acceptedOffer: offerMessage.offerAmount,
              acceptedBuyerId: offerMessage.senderId,
              acceptedAt: new Date().toISOString()
            }
          }
        );
      }
    }

    await messagesCollection.updateOne(
      { id: offerMessage.id },
      { $set: { offerStatus: offerMessage.offerStatus, respondedAt: offerMessage.respondedAt, respondedBy: offerMessage.respondedBy } }
    );
    res.json({ success: true, action, offer: removeMongoId(offerMessage) });
  } catch (error) {
    console.error('Error processing offer action:', error);
    res.status(500).json({ error: 'Failed to process offer action' });
  }
});


// Get new messages after timestamp (for real-time updates)
router.get('/item/:itemId/poll/:timestamp', async (req, res) => {
  try {
    const messagesCollection = getCollection(collections.messages);
    const since = new Date(req.params.timestamp);
    const itemId = req.params.itemId;
    
    // Validate timestamp
    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp format' });
    }
    
    const newMessages = await messagesCollection
      .find({
        itemId,
        timestamp: { $gt: since.toISOString() }
      })
      .sort({ timestamp: 1 })
      .toArray();
    
    // Add polling info to response
    res.json({
      messages: newMessages.map(removeMongoId),
      lastTimestamp: newMessages.length > 0 ? newMessages[newMessages.length - 1].timestamp : req.params.timestamp,
      hasNew: newMessages.length > 0,
      pollAgainAfter: 2000
    });
  } catch (error) {
    console.error('Error in polling:', error);
    res.status(500).json({ error: 'Failed to fetch new messages' });
  }
});

// Get unread message count for a user
router.get('/unread/:userId', async (req, res) => {
  try {
    const messagesCollection = getCollection(collections.messages);
    const userId = req.params.userId;
    
    // Get all messages where user is not the sender and not system messages
    const unreadMessages = await messagesCollection.find({
      senderId: { $nin: [userId, 'system'] },
      $or: [{ readBy: { $exists: false } }, { readBy: { $nin: [userId] } }]
    }).toArray();
    
    // Group by item
    const unreadByItem = {};
    unreadMessages.forEach(msg => {
      if (!unreadByItem[msg.itemId]) {
        unreadByItem[msg.itemId] = 0;
      }
      unreadByItem[msg.itemId]++;
    });
    
    res.json({
      total: unreadMessages.length,
      byItem: unreadByItem
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark messages as read
router.post('/read', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    const messagesCollection = getCollection(collections.messages);
    await messagesCollection.updateMany(
      { itemId, senderId: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Delete a message
router.delete('/:id', async (req, res) => {
  try {
    const messagesCollection = getCollection(collections.messages);
    await messagesCollection.deleteOne({ id: req.params.id });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;