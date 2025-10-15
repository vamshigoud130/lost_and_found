const express = require('express');
const Match = require('../models/Match');
const Item = require('../models/Item');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create a potential match between two items
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { itemAId, itemBId, notes } = req.body;
    if (!itemAId || !itemBId) {
      return res.status(400).json({ error: 'Missing item ids' });
    }
    if (itemAId === itemBId) {
      return res.status(400).json({ error: 'Items must be different' });
    }
    // Validate items exist
    const [a, b] = await Promise.all([
      Item.findById(itemAId),
      Item.findById(itemBId),
    ]);
    if (!a || !b) return res.status(404).json({ error: 'Item not found' });

    const key = itemAId < itemBId ? { itemAId, itemBId } : { itemAId: itemBId, itemBId: itemAId };
    const match = await Match.findOneAndUpdate(
      key,
      { ...key, createdByUserId: req.userId, notes },
      { new: true, upsert: true }
    );
    res.status(201).json(match);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// List matches for my items
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const myItemIds = await Item.find({ userId: req.userId }).distinct('_id');
    const matches = await Match.find({ $or: [ { itemAId: { $in: myItemIds } }, { itemBId: { $in: myItemIds } } ] })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('itemAId')
      .populate('itemBId');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;


