const db = require('../config/database');

async function calculateUserRating(userId) {
  const result = await db.query(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
     FROM reviews 
     WHERE reviewee_id = $1 AND is_frozen = FALSE`,
    [userId]
  );
  
  const avgRating = parseFloat(result.rows[0].avg_rating) || 0;
  const reviewCount = parseInt(result.rows[0].review_count);
  
  await db.query(
    `UPDATE users SET rating = $1 WHERE id = $2`,
    [avgRating.toFixed(2), userId]
  );
  
  return { rating: avgRating.toFixed(2), reviewCount };
}

async function createReview(taskId, reviewerId, revieweeId, rating, comment) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Check if review already exists for this task
    const existing = await client.query(
      'SELECT * FROM reviews WHERE task_id = $1 AND reviewer_id = $2',
      [taskId, reviewerId]
    );
    
    if (existing.rows.length > 0) {
      throw new Error('Review already exists for this task');
    }
    
    // Verify task completion
    const task = await client.query(
      `SELECT * FROM tasks WHERE id = $1 AND status = 'completed'`,
      [taskId]
    );
    
    if (task.rows.length === 0) {
      throw new Error('Can only review completed tasks');
    }
    
    const review = await client.query(
      `INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [taskId, reviewerId, revieweeId, rating, comment]
    );
    
    await client.query('COMMIT');
    
    await calculateUserRating(revieweeId);
    
    return review.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function freezeReview(reviewId, reason, moderatorId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const review = await client.query(
      `UPDATE reviews SET is_frozen = TRUE, freeze_reason = $1
       WHERE id = $2 RETURNING *`,
      [reason, reviewId]
    );
    
    if (review.rows.length === 0) {
      throw new Error('Review not found');
    }
    
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value)
       VALUES ($1, 'FREEZE_REVIEW', 'review', $2, $3)`,
      [moderatorId, reviewId, JSON.stringify({ reason })]
    );
    
    await client.query('COMMIT');
    
    await calculateUserRating(review.rows[0].reviewee_id);
    
    return review.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function unfreezeReview(reviewId, moderatorId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const review = await client.query(
      `UPDATE reviews SET is_frozen = FALSE, freeze_reason = NULL
       WHERE id = $1 RETURNING *`,
      [reviewId]
    );
    
    if (review.rows.length === 0) {
      throw new Error('Review not found');
    }
    
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
       VALUES ($1, 'UNFREEZE_REVIEW', 'review', $2)`,
      [moderatorId, reviewId]
    );
    
    await client.query('COMMIT');
    
    await calculateUserRating(review.rows[0].reviewee_id);
    
    return review.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getUserReviews(userId, limit = 10, offset = 0) {
  const result = await db.query(
    `SELECT r.*, 
            rev.username as reviewer_name,
            rev.avatar_url as reviewer_avatar
     FROM reviews r
     JOIN users rev ON r.reviewer_id = rev.id
     WHERE r.reviewee_id = $1 AND r.is_frozen = FALSE
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  
  return result.rows;
}

module.exports = {
  calculateUserRating,
  createReview,
  freezeReview,
  unfreezeReview,
  getUserReviews
};