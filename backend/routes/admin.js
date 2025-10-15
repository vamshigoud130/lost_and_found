const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Item = require('../models/Item');
const Match = require('../models/Match');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

async function logAudit(actorId, action, entityType, entityId, meta = {}) {
  try {
    await AuditLog.create({ actorId, action, entityType, entityId, meta });
  } catch (e) {
    // Best-effort; do not block on audit
  }
}

// Get all items with user details
router.get('/items', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const query = {};
    
    if (type) query.type = type;
    if (status === 'resolved') query.isResolved = true;
    if (status === 'open') query.isResolved = false;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Item.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Item.countDocuments(query);

    res.json({
      items,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get single item with details
router.get('/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('userId', 'name email phone');
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Update item status
router.patch('/items/:id/status', async (req, res) => {
  try {
    const { isResolved } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { isResolved },
      { new: true }
    ).populate('userId', 'name email');
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    logAudit(req.userId, 'update_item_status', 'Item', item._id, { isResolved });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// Delete item
router.delete('/items/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    // Also delete related matches
    await Match.deleteMany({
      $or: [{ itemAId: item._id }, { itemBId: item._id }]
    });
    
    logAudit(req.userId, 'delete_item', 'Item', item._id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Moderate item (approve/reject)
router.patch('/items/:id/moderate', async (req, res) => {
  try {
    const { moderationStatus, moderationNotes } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(moderationStatus)) {
      return res.status(400).json({ error: 'Invalid moderation status' });
    }
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { moderationStatus, moderationNotes },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    logAudit(req.userId, 'moderate_item', 'Item', item._id, { moderationStatus });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to moderate item' });
  }
});

// Get all matches
router.get('/matches', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const matches = await Match.find(query)
      .populate('itemAId')
      .populate('itemBId')
      .populate('createdByUserId', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Match.countDocuments(query);

    res.json({
      matches,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get match by id with details
router.get('/matches/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('itemAId')
      .populate('itemBId')
      .populate('createdByUserId', 'name email')
      .populate('resolvedBy', 'name email');
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Update match status
router.patch('/matches/:id/status', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updateData = { status };
    
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (status === 'resolved') {
      updateData.resolvedBy = req.userId;
      updateData.resolvedAt = new Date();
    }

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('itemAId')
    .populate('itemBId')
    .populate('createdByUserId', 'name email')
    .populate('resolvedBy', 'name email');

    if (!match) return res.status(404).json({ error: 'Match not found' });
    logAudit(req.userId, 'update_match_status', 'Match', match._id, { status });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update match status' });
  }
});

// Create match manually
router.post('/matches', async (req, res) => {
  try {
    const { itemAId, itemBId, notes } = req.body;
    
    // Check if items exist
    const itemA = await Item.findById(itemAId);
    const itemB = await Item.findById(itemBId);
    
    if (!itemA || !itemB) {
      return res.status(404).json({ error: 'One or both items not found' });
    }
    
    // Check if match already exists
    const existingMatch = await Match.findOne({
      $or: [
        { itemAId, itemBId },
        { itemAId: itemBId, itemBId: itemAId }
      ]
    });
    
    if (existingMatch) {
      return res.status(400).json({ error: 'Match already exists' });
    }
    
    const match = new Match({
      itemAId,
      itemBId,
      createdByUserId: req.userId,
      notes,
      status: 'pending'
    });
    
    await match.save();
    await match.populate('itemAId itemBId createdByUserId', 'name email');
    
    logAudit(req.userId, 'create_match', 'Match', match._id);
    // Notify owners (best-effort)
    try {
      const owners = [itemA.userId, itemB.userId].filter(Boolean);
      await Notification.insertMany(owners.map(o => ({ recipientId: o, type: 'match', message: 'A potential match was created for your item.', meta: { matchId: match._id } })));
    } catch {}
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const openItems = await Item.countDocuments({ isResolved: false });
    const resolvedItems = await Item.countDocuments({ isResolved: true });
    const lostItems = await Item.countDocuments({ type: 'lost', isResolved: false });
    const foundItems = await Item.countDocuments({ type: 'found', isResolved: false });
    const totalMatches = await Match.countDocuments();
    const pendingMatches = await Match.countDocuments({ status: 'pending' });
    const confirmedMatches = await Match.countDocuments({ status: 'confirmed' });
    const resolvedMatches = await Match.countDocuments({ status: 'resolved' });
    const totalUsers = await User.countDocuments();

    res.json({
      items: {
        total: totalItems,
        open: openItems,
        resolved: resolvedItems,
        lost: lostItems,
        found: foundItems
      },
      matches: {
        total: totalMatches,
        pending: pendingMatches,
        confirmed: confirmedMatches,
        resolved: resolvedMatches
      },
      users: {
        total: totalUsers
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Settings: get list
router.get('/settings', async (req, res) => {
  try {
    const settings = await Setting.find().sort({ key: 1 });
    res.json({ settings });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

// Settings: upsert
router.put('/settings', async (req, res) => {
  try {
    const entries = req.body?.settings || [];
    for (const s of entries) {
      await Setting.findOneAndUpdate({ key: s.key }, { value: s.value }, { upsert: true });
    }
    logAudit(req.userId, 'update_settings', 'Setting', null, { keys: entries.map(e=>e.key) });
    const settings = await Setting.find().sort({ key: 1 });
    res.json({ settings });
  } catch (e) { res.status(500).json({ error: 'Failed to save settings' }); }
});

// Notifications: list for a user (admin can view by userId)
router.get('/notifications', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;
    const q = userId ? { recipientId: userId } : {};
    const notifs = await Notification.find(q).sort({ createdAt: -1 }).limit(Number(limit)).skip((Number(page)-1)*Number(limit));
    const total = await Notification.countDocuments(q);
    res.json({ notifications: notifs, total });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch notifications' }); }
});

// Notifications: send
router.post('/notifications', async (req, res) => {
  try {
    const { recipients = [], message, type = 'general', meta } = req.body;
    if (!message || !recipients.length) return res.status(400).json({ error: 'Recipients and message required' });
    const docs = recipients.map(r => ({ recipientId: r, message, type, meta }));
    const created = await Notification.insertMany(docs);
    logAudit(req.userId, 'send_notification', 'User', null, { count: created.length });
    res.status(201).json({ created: created.length });
  } catch (e) { res.status(500).json({ error: 'Failed to send notifications' }); }
});

// Admin: Delete notification
router.delete('/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    logAudit(req.userId, 'delete_notification', 'Notification', req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Admin: Delete multiple notifications
router.delete('/notifications/bulk', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }
    const result = await Notification.deleteMany({ _id: { $in: notificationIds } });
    logAudit(req.userId, 'delete_notifications_bulk', 'Notification', null, { count: result.deletedCount });
    res.json({ 
      message: `${result.deletedCount} notifications deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// Admin: Clear all notifications for a user
router.delete('/notifications/user/:userId', async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipientId: req.params.userId });
    logAudit(req.userId, 'clear_user_notifications', 'User', req.params.userId, { count: result.deletedCount });
    res.json({ 
      message: `${result.deletedCount} notifications deleted for user`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear user notifications' });
  }
});

// Send email to match owners
router.post('/matches/:id/send-email', async (req, res) => {
  try {
    const { id } = req.params;
    const { customMessage } = req.body;
    
    // Get match with populated items and users
    const match = await Match.findById(id)
      .populate({
        path: 'itemAId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate({
        path: 'itemBId', 
        populate: { path: 'userId', select: 'name email' }
      });
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    const emailService = require('../services/emailService');
    const results = [];
    
    // Send email to both owners
    const owners = [
      { user: match.itemAId?.userId, item: match.itemAId },
      { user: match.itemBId?.userId, item: match.itemBId }
    ].filter(owner => owner.user && owner.user.email);
    
    for (const owner of owners) {
      try {
        const result = await emailService.sendMatchNotificationEmail(
          owner.user.email,
          owner.user.name,
          {
            status: match.status,
            createdAt: match.createdAt,
            notes: match.notes
          },
          customMessage
        );
        results.push({ 
          email: owner.user.email, 
          success: result.success, 
          error: result.error 
        });
      } catch (error) {
        results.push({ 
          email: owner.user.email, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // Always create in-app notifications (even if email fails)
    try {
      const notificationDocs = owners.map(owner => ({
        recipientId: owner.user._id,
        type: 'match',
        message: customMessage || `A ${match.status} match was found for your item.`,
        meta: { matchId: match._id }
      }));
      await Notification.insertMany(notificationDocs);
      console.log(`Created ${notificationDocs.length} in-app notifications`);
    } catch (notificationError) {
      console.error('Failed to create in-app notifications:', notificationError);
    }
    
    logAudit(req.userId, 'send_match_email', 'Match', match._id, { 
      emailsSent: results.filter(r => r.success).length,
      totalEmails: results.length 
    });
    
    res.status(200).json({ 
      success: true, 
      results,
      emailsSent: results.filter(r => r.success).length,
      totalEmails: results.length
    });
  } catch (error) {
    console.error('Failed to send match emails:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

// Analytics: trends and categories
router.get('/analytics/trends', async (req, res) => {
  try {
    const { period = 'month', limit = 6 } = req.query;
    const groupId = period === 'week' ? { year: { $year: '$createdAt' }, week: { $isoWeek: '$createdAt' } } : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };

    const byType = await Item.aggregate([
      { $group: { _id: { ...groupId, type: '$type' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1 } },
      { $limit: 2 * Number(limit) }
    ]);

    const resolved = await Item.aggregate([
      { $group: { _id: groupId, resolved: { $sum: { $cond: ['$isResolved', 1, 0] } }, total: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1 } },
      { $limit: Number(limit) }
    ]);

    const categories = await Item.aggregate([
      { $match: { category: { $exists: true, $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ byType, resolved, categories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-passwordHash');
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    logAudit(req.userId, 'update_user_role', 'User', user._id, { role });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Suspend/Unsuspend user
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    const { isSuspended } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: !!isSuspended },
      { new: true }
    ).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    logAudit(req.userId, 'suspend_user', 'User', user._id, { isSuspended: !!isSuspended });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user suspension' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    logAudit(req.userId, 'delete_user', 'User', user._id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// List audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await AuditLog.find()
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await AuditLog.countDocuments();
    res.json({ logs, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
