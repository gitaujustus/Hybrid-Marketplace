
import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const usersPath = join(__dirname, '../data/users.json');

const readUsers = () => {
  const data = readFileSync(usersPath);
  return JSON.parse(data);
};

const writeUsers = (users) => {
  writeFileSync(usersPath, JSON.stringify(users, null, 2));
};

// Hash password
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Login user
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const users = readUsers();
    const hashedPassword = hashPassword(password);
    let user = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password for existing user
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    writeUsers(users);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ ...userWithoutPassword, isNewUser: false });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Register new user (alternative endpoint)
router.post('/register', (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }
    
    const users = readUsers();
    const existingUser = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = hashPassword(password);
    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    users.push(newUser);
    writeUsers(users);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Get all users (without passwords)
router.get('/', (req, res) => {
  try {
    const users = readUsers();
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    res.json(usersWithoutPasswords);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (without password)
router.get('/:id', (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user password
router.put('/:id/password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const hashedOldPassword = hashPassword(oldPassword);
    if (users[userIndex].password !== hashedOldPassword) {
      return res.status(401).json({ error: 'Invalid old password' });
    }
    
    users[userIndex].password = hashPassword(newPassword);
    writeUsers(users);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;