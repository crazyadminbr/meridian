// ============================================================================
// controllers/forumController.js
// Категории, темы, сообщения, лайки, цитирование, поиск по форуму.
// ============================================================================

const db = require('../database/db');
const { publicUser, parsePagination, isStaffRole } = require('../utils/helpers');
const { createNotification } = require('./notificationController');

// ---------------------------------------------------------------------------
// Категории
// ---------------------------------------------------------------------------

// GET /api/forum/categories
function listCategories(req, res) {
  const categories = db.all('SELECT * FROM categories ORDER BY sort_order ASC');

  const result = categories.map((cat) => {
    const topicsCount = db.get('SELECT COUNT(*) as c FROM topics WHERE category_id = ?', [cat.id]).c;
    const postsCount = db.get(
      `SELECT COUNT(*) as c FROM posts p JOIN topics t ON p.topic_id = t.id WHERE t.category_id = ? AND p.is_deleted = 0`,
      [cat.id]
    ).c;
    const lastPost = db.get(
      `SELECT p.created_at, u.nickname, u.avatar, t.id as topic_id, t.title as topic_title
       FROM posts p
       JOIN topics t ON p.topic_id = t.id
       JOIN users u ON p.user_id = u.id
       WHERE t.category_id = ? AND p.is_deleted = 0
       ORDER BY p.created_at DESC LIMIT 1`,
      [cat.id]
    );
    return { ...cat, topicsCount, postsCount, lastPost: lastPost || null };
  });

  res.json({ categories: result });
}

// GET /api/forum/categories/:slug/topics
function listTopicsByCategory(req, res) {
  const category = db.get('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
  if (!category) return res.status(404).json({ error: 'Категория не найдена' });

  const { page, limit, offset } = parsePagination(req, 15, 50);
  const total = db.get('SELECT COUNT(*) as c FROM topics WHERE category_id = ?', [category.id]).c;

  const topics = db.all(
    `SELECT t.*, u.nickname as author_nickname, u.avatar as author_avatar, u.role as author_role
     FROM topics t JOIN users u ON t.user_id = u.id
     WHERE t.category_id = ?
     ORDER BY t.is_pinned DESC, t.updated_at DESC
     LIMIT ? OFFSET ?`,
    [category.id, limit, offset]
  );

  const enriched = topics.map((t) => {
    const postsCount = db.get('SELECT COUNT(*) as c FROM posts WHERE topic_id = ? AND is_deleted = 0', [t.id]).c;
    const lastPost = db.get(
      `SELECT p.created_at, u.nickname, u.avatar FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.topic_id = ? AND p.is_deleted = 0 ORDER BY p.created_at DESC LIMIT 1`,
      [t.id]
    );
    return { ...t, postsCount, lastPost: lastPost || null };
  });

  res.json({
    category,
    topics: enriched,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

// POST /api/forum/categories/:id/topics — создать тему (с первым сообщением)
function createTopic(req, res) {
  const category = db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!category) return res.status(404).json({ error: 'Категория не найдена' });

  if (category.staff_only && !isStaffRole(req.user.role)) {
    return res.status(403).json({ error: 'Создавать темы в этом разделе могут только модераторы, администраторы и Команда Проекта' });
  }

  const { title, content } = req.body;
  if (!title || title.trim().length < 3) {
    return res.status(400).json({ error: 'Заголовок темы должен быть не короче 3 символов' });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ error: 'Заголовок темы не может быть длиннее 200 символов' });
  }
  if (!content || content.trim().length < 2) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'Сообщение не может быть длиннее 1000 символов' });
  }

  const { lastInsertRowid: topicId } = db.run(
    `INSERT INTO topics (category_id, user_id, title) VALUES (?, ?, ?)`,
    [category.id, req.user.id, title.trim().slice(0, 200)]
  );
  db.run(`INSERT INTO posts (topic_id, user_id, content) VALUES (?, ?, ?)`, [topicId, req.user.id, content]);

  const topic = db.get('SELECT * FROM topics WHERE id = ?', [topicId]);
  res.status(201).json({ message: 'Тема создана', topic });
}

// ---------------------------------------------------------------------------
// Темы и сообщения
// ---------------------------------------------------------------------------

// GET /api/forum/topics/:id
function getTopic(req, res) {
  const topic = db.get(
    `SELECT t.*, u.nickname as author_nickname, u.avatar as author_avatar, u.role as author_role,
            c.slug as category_slug, c.name as category_name, c.staff_only as category_staff_only
     FROM topics t
     JOIN users u ON t.user_id = u.id
     JOIN categories c ON t.category_id = c.id
     WHERE t.id = ?`,
    [req.params.id]
  );
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

  db.run('UPDATE topics SET views = views + 1 WHERE id = ?', [topic.id]);

  const { page, limit, offset } = parsePagination(req, 20, 50);
  const total = db.get('SELECT COUNT(*) as c FROM posts WHERE topic_id = ? AND is_deleted = 0', [topic.id]).c;

  const posts = db.all(
    `SELECT p.*, u.nickname, u.avatar, u.role, u.reputation, u.status as user_status, u.created_at as user_created_at
     FROM posts p JOIN users u ON p.user_id = u.id
     WHERE p.topic_id = ? AND p.is_deleted = 0
     ORDER BY p.created_at ASC LIMIT ? OFFSET ?`,
    [topic.id, limit, offset]
  );

  const userId = req.user ? req.user.id : 0;
  const enrichedPosts = posts.map((p) => {
    const likesCount = db.get('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [p.id]).c;
    const likedByMe = userId
      ? !!db.get('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?', [p.id, userId])
      : false;
    let quoted = null;
    if (p.quote_post_id) {
      quoted = db.get(
        `SELECT p.id, p.content, u.nickname FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
        [p.quote_post_id]
      );
    }
    return { ...p, likesCount, likedByMe, quoted };
  });

  res.json({
    topic,
    posts: enrichedPosts,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

// PUT /api/forum/topics/:id — редактирование заголовка темы (ТОЛЬКО автор — персонал может
// удалять темы для модерации, но не подменять чужой текст, см. updatePost для той же логики)
function updateTopic(req, res) {
  const topic = db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

  const isOwner = topic.user_id === req.user.id;
  if (!isOwner) return res.status(403).json({ error: 'Редактировать тему может только её автор' });

  const { title } = req.body;
  if (title && title.trim().length >= 3) {
    db.run('UPDATE topics SET title = ?, updated_at = datetime(\'now\') WHERE id = ?', [title.trim().slice(0, 200), topic.id]);
  }
  res.json({ message: 'Тема обновлена', topic: db.get('SELECT * FROM topics WHERE id = ?', [topic.id]) });
}

// DELETE /api/forum/topics/:id — удаление темы (автор, либо персонал — модерация)
function deleteTopic(req, res) {
  const topic = db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

  const isOwner = topic.user_id === req.user.id;
  if (!isOwner && !isStaffRole(req.user.role)) return res.status(403).json({ error: 'Вы не можете удалить эту тему' });

  db.run('DELETE FROM topics WHERE id = ?', [topic.id]); // posts удалятся каскадно (ON DELETE CASCADE)
  res.json({ message: 'Тема удалена' });
}

// POST /api/forum/topics/:id/posts — ответить в теме (можно с цитатой)
function addPost(req, res) {
  const topic = db.get(
    `SELECT t.*, c.staff_only as category_staff_only FROM topics t JOIN categories c ON t.category_id = c.id WHERE t.id = ?`,
    [req.params.id]
  );
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  if (topic.is_locked && !isStaffRole(req.user.role)) {
    return res.status(403).json({ error: 'Тема закрыта для новых ответов' });
  }
  if (topic.category_staff_only && !isStaffRole(req.user.role)) {
    return res.status(403).json({ error: 'Отвечать в этом разделе могут только модераторы, администраторы и Команда Проекта' });
  }

  const { content, quote_post_id } = req.body;
  if (!content || content.trim().length < 1) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'Сообщение не может быть длиннее 1000 символов' });
  }

  let quoteId = null;
  if (quote_post_id) {
    const quoted = db.get('SELECT * FROM posts WHERE id = ? AND topic_id = ?', [quote_post_id, topic.id]);
    if (quoted) quoteId = quoted.id;
  }

  const { lastInsertRowid: postId } = db.run(
    `INSERT INTO posts (topic_id, user_id, content, quote_post_id) VALUES (?, ?, ?, ?)`,
    [topic.id, req.user.id, content, quoteId]
  );
  db.run('UPDATE topics SET updated_at = datetime(\'now\') WHERE id = ?', [topic.id]);

  // Уведомление автору темы о новом ответе (если отвечает не он сам)
  if (topic.user_id !== req.user.id) {
    createNotification(
      topic.user_id,
      'reply',
      `${req.user.nickname} ответил(а) в вашей теме «${topic.title}»`,
      `/topic.html?id=${topic.id}`
    );
  }
  // Уведомление автору цитируемого сообщения
  if (quoteId) {
    const quotedPost = db.get('SELECT * FROM posts WHERE id = ?', [quoteId]);
    if (quotedPost && quotedPost.user_id !== req.user.id) {
      createNotification(
        quotedPost.user_id,
        'quote',
        `${req.user.nickname} процитировал(а) ваше сообщение`,
        `/topic.html?id=${topic.id}`
      );
    }
  }

  const post = db.get(
    `SELECT p.*, u.nickname, u.avatar, u.role FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [postId]
  );
  res.status(201).json({ message: 'Ответ добавлен', post });
}

// PUT /api/forum/posts/:id — редактировать своё сообщение (ТОЛЬКО автор — даже администратор
// не может менять текст чужого сообщения, чтобы исключить подмену слов пользователя;
// для модерации недопустимого контента персонал должен использовать удаление, а не правку)
function updatePost(req, res) {
  const post = db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Сообщение не найдено' });

  const isOwner = post.user_id === req.user.id;
  if (!isOwner) return res.status(403).json({ error: 'Редактировать сообщение может только его автор' });

  const { content } = req.body;
  if (!content || content.trim().length < 1) return res.status(400).json({ error: 'Сообщение не может быть пустым' });

  db.run('UPDATE posts SET content = ?, updated_at = datetime(\'now\') WHERE id = ?', [content, post.id]);

  // Если это первое сообщение темы — оно же "тело" темы, тоже обновим updated_at темы
  res.json({ message: 'Сообщение обновлено', post: db.get('SELECT * FROM posts WHERE id = ?', [post.id]) });
}

// DELETE /api/forum/posts/:id — удалить сообщение (автор, либо персонал — модерация). Мягкое удаление.
function deletePost(req, res) {
  const post = db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Сообщение не найдено' });

  const isOwner = post.user_id === req.user.id;
  if (!isOwner && !isStaffRole(req.user.role)) return res.status(403).json({ error: 'Вы не можете удалить это сообщение' });

  const firstPost = db.get('SELECT id FROM posts WHERE topic_id = ? ORDER BY created_at ASC LIMIT 1', [post.topic_id]);
  if (firstPost && firstPost.id === post.id) {
    return res.status(400).json({ error: 'Это первое сообщение темы. Удалите тему целиком вместо этого.' });
  }

  db.run('UPDATE posts SET is_deleted = 1, content = \'[сообщение удалено]\' WHERE id = ?', [post.id]);
  res.json({ message: 'Сообщение удалено' });
}

// POST /api/forum/posts/:id/like — поставить/убрать лайк
function toggleLike(req, res) {
  const post = db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Сообщение не найдено' });

  const existing = db.get('SELECT * FROM likes WHERE post_id = ? AND user_id = ?', [post.id, req.user.id]);
  if (existing) {
    db.run('DELETE FROM likes WHERE id = ?', [existing.id]);
    const count = db.get('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [post.id]).c;
    return res.json({ liked: false, likesCount: count });
  }

  db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [post.id, req.user.id]);
  if (post.user_id !== req.user.id) {
    db.run('UPDATE users SET reputation = reputation + 1 WHERE id = ?', [post.user_id]);
    createNotification(post.user_id, 'like', `${req.user.nickname} оценил(а) ваше сообщение`, `/topic.html?id=${post.topic_id}`);
  }
  const count = db.get('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [post.id]).c;
  res.json({ liked: true, likesCount: count });
}

// ---------------------------------------------------------------------------
// Поиск
// ---------------------------------------------------------------------------

// GET /api/forum/search?q=
function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ topics: [], posts: [] });

  const like = `%${q}%`;

  const topics = db.all(
    `SELECT t.*, u.nickname as author_nickname, c.slug as category_slug, c.name as category_name
     FROM topics t JOIN users u ON t.user_id = u.id JOIN categories c ON t.category_id = c.id
     WHERE t.title LIKE ? ORDER BY t.updated_at DESC LIMIT 20`,
    [like]
  );

  const posts = db.all(
    `SELECT p.id, p.content, p.topic_id, p.created_at, u.nickname as author_nickname, t.title as topic_title
     FROM posts p JOIN users u ON p.user_id = u.id JOIN topics t ON p.topic_id = t.id
     WHERE p.content LIKE ? AND p.is_deleted = 0 ORDER BY p.created_at DESC LIMIT 20`,
    [like]
  );

  const users = db.all(`SELECT * FROM users WHERE nickname LIKE ? LIMIT 10`, [like]);

  res.json({ topics, posts, users: users.map(publicUser) });
}

module.exports = {
  listCategories,
  listTopicsByCategory,
  createTopic,
  getTopic,
  updateTopic,
  deleteTopic,
  addPost,
  updatePost,
  deletePost,
  toggleLike,
  search,
};
