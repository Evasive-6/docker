const { calculatePriority } = require('../utils/priority.util');

/**
 * Middleware to update priority when upvotes change
 * This runs before save on Report model
 */
const updatePriorityMiddleware = function(next) {
  // Only run for updates that include upvotes or for new reports
  if (this.isModified('upvotes') || this.isNew) {
    const priority = calculatePriority(this.upvotes || 0);
    this.priorityScore = priority.score;
    this.lastPriorityUpdate = new Date();
  }
  next();
};

/**
 * Middleware to update priority on findOneAndUpdate operations
 */
const updatePriorityMiddlewareUpdate = function(next) {
  const update = this.getUpdate();
  
  // Check if upvotes is being updated
  if (update.$set && update.$set.upvotes !== undefined) {
    const priority = calculatePriority(update.$set.upvotes);
    update.$set.priorityScore = priority.score;
    update.$set.lastPriorityUpdate = new Date();
  } else if (update.$inc && update.$inc.upvotes !== undefined) {
    // For incremental updates, we need to get current document
    this.populate('priorityScore upvotes');
    
    // Add a post hook to update priority after the increment
    this.post('findOneAndUpdate', function(doc) {
      if (doc) {
        const priority = calculatePriority(doc.upvotes || 0);
        doc.priorityScore = priority.score;
        doc.lastPriorityUpdate = new Date();
        doc.save();
      }
    });
  }
  
  next();
};

module.exports = {
  updatePriorityMiddleware,
  updatePriorityMiddlewareUpdate
};