const express = require('express');
const Item = require('../models/Item');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create item (lost or found)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, name, description, location, date, imageBase64, email, mobileNumber } = req.body;
    if (!type || !name || !location || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify user exists
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if contact information is provided in the form
    if (!email || !mobileNumber) {
      return res.status(400).json({ 
        error: 'Email and mobile number are required for reporting items.' 
      });
    }
    
    // Update user's contact information if provided
    if (email && mobileNumber) {
      await User.findByIdAndUpdate(req.userId, { 
        email: email.trim(), 
        mobileNumber: mobileNumber.trim() 
      });
    }
    
    const item = await Item.create({
      userId: req.userId,
      type,
      name,
      description,
      location,
      date,
      imageBase64,
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('Error creating item:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Mark resolved
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isResolved: true },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve item' });
  }
});

// Get my items
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Browse/search items (public)
router.get('/', async (req, res) => {
  try {
    const { q, location, type } = req.query;
    const filter = { moderationStatus: 'approved' };
    if (type) filter.type = type;
    if (location) filter.location = location;
    if (q) filter.$text = { $search: q };
    const items = await Item.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

module.exports = router;


