import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const messagesPath = join(__dirname, '../data/messages.json');

const readMessages = () => {
  const data = readFileSync(messagesPath);
  return JSON.parse(data);
};

const writeMessages = (messages) => {
  writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
};


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