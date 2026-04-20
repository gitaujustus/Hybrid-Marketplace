import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { collections, getCollection, removeMongoId } from '../src/db.js';

const router = express.Router();

// Hash password
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const verifyPassword = (storedPassword, providedPassword) => {
  if (!storedPassword) return false;
  const hashedProvided = hashPassword(providedPassword);
  // Support both hashed and legacy plaintext passwords.
  return storedPassword === hashedProvided || storedPassword === providedPassword;
};

const buildUserLookupQuery = (normalizedName) => ({
  $or: [
    { nameLower: normalizedName },
    { name: { $regex: `^${normalizedName}$`, $options: 'i' } }
  ]
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const usersCollection = getCollection(collections.users);
    const normalizedName = name.trim().toLowerCase();
    const user = await usersCollection.findOne(buildUserLookupQuery(normalizedName));
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password for existing user
    if (!verifyPassword(user.password, password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login. In production/serverless this can be read-only,
    // so login should still succeed even if persistence fails.
    const lastLogin = new Date().toISOString();
    try {
      await usersCollection.updateOne(
        { id: user.id },
        { $set: { lastLogin } }
      );
    } catch (writeError) {
      console.warn('Could not persist lastLogin:', writeError.message);
    }

    // Return user without password
    user.lastLogin = lastLogin;
    const { password: _, nameLower: __, ...userWithoutPassword } = user;
    return res.json({ ...userWithoutPassword, isNewUser: false });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Register new user (alternative endpoint)
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }
    
    const usersCollection = getCollection(collections.users);
    const normalizedName = name.trim().toLowerCase();
    const existingUser = await usersCollection.findOne(buildUserLookupQuery(normalizedName));
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = hashPassword(password);
    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      nameLower: normalizedName,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    await usersCollection.insertOne(newUser);
    
    // Return user without password
    const { password: _, nameLower: __, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Get all users (without passwords)
router.get('/', async (req, res) => {
  try {
    const usersCollection = getCollection(collections.users);
    const users = await usersCollection.find({}).toArray();
    const usersWithoutPasswords = users.map(({ password, nameLower, ...user }) => user);
    res.json(usersWithoutPasswords.map(removeMongoId));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (without password)
router.get('/:id', async (req, res) => {
  try {
    const usersCollection = getCollection(collections.users);
    const user = await usersCollection.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, nameLower, ...userWithoutPassword } = user;
    res.json(removeMongoId(userWithoutPassword));
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user password
router.put('/:id/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const usersCollection = getCollection(collections.users);
    const user = await usersCollection.findOne({ id: req.params.id });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!verifyPassword(user.password, oldPassword)) {
      return res.status(401).json({ error: 'Invalid old password' });
    }
    
    await usersCollection.updateOne(
      { id: req.params.id },
      { $set: { password: hashPassword(newPassword) } }
    );
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;