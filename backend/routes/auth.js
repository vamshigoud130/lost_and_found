const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, mobileNumber } = req.body;
    if (!email || !password || !name || !mobileNumber) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name, and mobile number are required' });
    }
    
    // Basic mobile number validation
    const mobileRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!mobileRegex.test(mobileNumber.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }
    
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name, mobileNumber });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, mobileNumber: user.mobileNumber, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, mobileNumber: user.mobileNumber, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, mobileNumber } = req.body;
    const userId = req.userId; // This should come from auth middleware
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!name || !email || !mobileNumber) {
      return res.status(400).json({ error: 'Missing required fields: name, email, and mobile number are required' });
    }
    
    // Basic mobile number validation
    const mobileRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!mobileRegex.test(mobileNumber.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }
    
    // Check if email is already in use by another user
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use by another user' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email, mobileNumber },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        mobileNumber: user.mobileNumber, 
        role: user.role 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

module.exports = router;


