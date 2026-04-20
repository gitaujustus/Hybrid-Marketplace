import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const messagesPath = join(__dirname, '../data/messages.json');
const itemsPath = join(__dirname, '../data/items.json');

const readMessages = () => {
  const data = readFileSync(messagesPath);
  return JSON.parse(data);
};

const writeMessages = (messages) => {
  writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
};

const readItems = () => {
  const data = readFileSync(itemsPath);
  return JSON.parse(data);
};

const writeItems = (items) => {
  writeFileSync(itemsPath, JSON.stringify(items, null, 2));
};

const buildThreadId = (itemId, userA, userB) => {
  const [first, second] = [userA, userB].sort();
  return `${itemId}:${first}:${second}`;
};

// Get conversation summaries for a user (inbox)
router.get('/conversations/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId } = req.query;
    const messages = readMessages().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const items = readItems();
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

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get thread messages for a specific item and 2 participants
router.get('/thread', (req, res) => {
  try {
    const { itemId, userId, otherUserId, since } = req.query;

    if (!itemId || !userId || !otherUserId) {
      return res.status(400).json({ error: 'itemId, userId, and otherUserId are required' });
    }

    const messages = readMessages();
    const threadId = buildThreadId(itemId, userId, otherUserId);
    const sinceDate = since ? new Date(since) : null;

    if (since && isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid "since" timestamp format' });
    }

    const threadMessages = messages
      .filter(msg => msg.threadId === threadId)
      .filter(msg => !sinceDate || new Date(msg.timestamp) > sinceDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Mark messages as read for the requesting user
    let readUpdated = false;
    messages.forEach(msg => {
      if (msg.threadId === threadId && msg.receiverId === userId) {
        if (!msg.readBy) msg.readBy = [];
        if (!msg.readBy.includes(userId)) {
          msg.readBy.push(userId);
          readUpdated = true;
        }
      }
    });
    if (readUpdated) {
      writeMessages(messages);
    }

    const lastTimestamp = threadMessages.length
      ? threadMessages[threadMessages.length - 1].timestamp
      : since || null;

    res.json({
      threadId,
      messages: threadMessages,
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
router.post('/thread/message', (req, res) => {
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

    const items = readItems();
    const item = items.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const messages = readMessages();
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

      item.highestOffer = Math.max(item.highestOffer || 0, numericOffer);
      item.highestOfferBuyer = senderId;
      writeItems(items);
    }

    messages.push(newMessage);
    writeMessages(messages);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating thread message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Handle offer actions: accept, reject, counter
router.post('/offers/:id/action', (req, res) => {
  try {
    const { action, userId, userName, counterAmount } = req.body;
    const validActions = ['accept', 'reject', 'counter'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use accept, reject, or counter' });
    }

    const messages = readMessages();
    const messageIndex = messages.findIndex(msg => msg.id === req.params.id);
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Offer message not found' });
    }

    const offerMessage = messages[messageIndex];
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
      messages.push(counterMessage);

      const items = readItems();
      const item = items.find(i => i.id === offerMessage.itemId);
      if (item) {
        item.highestOffer = Math.max(item.highestOffer || 0, numericCounter);
        item.highestOfferBuyer = userId;
        writeItems(items);
      }

      writeMessages(messages);
      return res.json({ success: true, action, originalOffer: offerMessage, counterOffer: counterMessage });
    }

    offerMessage.offerStatus = action === 'accept' ? 'accepted' : 'rejected';
    offerMessage.respondedAt = new Date().toISOString();
    offerMessage.respondedBy = userId;

    if (action === 'accept') {
      const items = readItems();
      const item = items.find(i => i.id === offerMessage.itemId);
      if (item) {
        item.status = 'reserved';
        item.acceptedOffer = offerMessage.offerAmount;
        item.acceptedBuyerId = offerMessage.senderId;
        item.acceptedAt = new Date().toISOString();
        writeItems(items);
      }
    }

    writeMessages(messages);
    res.json({ success: true, action, offer: offerMessage });
  } catch (error) {
    console.error('Error processing offer action:', error);
    res.status(500).json({ error: 'Failed to process offer action' });
  }
});


// Get new messages after timestamp (for real-time updates)
router.get('/item/:itemId/poll/:timestamp', (req, res) => {
  try {
    const messages = readMessages();
    const since = new Date(req.params.timestamp);
    const itemId = req.params.itemId;
    
    // Validate timestamp
    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp format' });
    }
    
    const newMessages = messages.filter(m => 
      m.itemId === itemId && 
      new Date(m.timestamp) > since
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Add polling info to response
    res.json({
      messages: newMessages,
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
router.get('/unread/:userId', (req, res) => {
  try {
    const messages = readMessages();
    const userId = req.params.userId;
    
    // Get all messages where user is not the sender and not system messages
    const unreadMessages = messages.filter(m => 
      m.senderId !== userId && 
      m.senderId !== 'system' &&
      !m.readBy?.includes(userId)
    );
    
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
router.post('/read', (req, res) => {
  try {
    const { userId, itemId, messageIds } = req.body;
    const messages = readMessages();
    
    messages.forEach(message => {
      if (message.itemId === itemId && message.senderId !== userId) {
        if (!message.readBy) message.readBy = [];
        if (!message.readBy.includes(userId)) {
          message.readBy.push(userId);
        }
      }
    });
    
    writeMessages(messages);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Delete a message
router.delete('/:id', (req, res) => {
  try {
    const messages = readMessages();
    const filtered = messages.filter(m => m.id !== req.params.id);
    writeMessages(filtered);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;