import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { initDatabase, getDatabase, saveDatabase, executeInsert } from './db';
import { User, Discussion, Comment, Operation, CommentTree, DiscussionWithComments } from './models';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to build comment tree
const buildCommentTree = (comments: Comment[]): CommentTree[] => {
  const commentMap = new Map<number, CommentTree>();
  const rootComments: CommentTree[] = [];

  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, children: [] });
  });

  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;
    if (comment.parentId === null) {
      rootComments.push(node);
    } else {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  });

  return rootComments;
};

// Calculate result based on operation
const calculateResult = (leftOperand: number, operation: Operation, rightOperand: number): number => {
  switch (operation) {
    case Operation.ADD:
      return leftOperand + rightOperand;
    case Operation.SUBTRACT:
      return leftOperand - rightOperand;
    case Operation.MULTIPLY:
      return leftOperand * rightOperand;
    case Operation.DIVIDE:
      if (rightOperand === 0) throw new Error('Division by zero');
      return leftOperand / rightOperand;
    default:
      throw new Error('Invalid operation');
  }
};

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDatabase();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check if username already exists
    const checkResult = db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (checkResult.length && checkResult[0].values.length) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      const userId = executeInsert('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
      saveDatabase();

      console.log('Registered user:', userId, username);

      const token = jwt.sign({ id: userId, username }, JWT_SECRET);
      
      res.json({ token, user: { id: userId, username } });
    } catch (error: any) {
      console.error('Insert error:', error);
      if (error.message?.includes('UNIQUE')) {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDatabase();

    const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);

    if (!result.length || !result[0].values.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const row = result[0].values[0];
    const user: User = {
      id: row[0] as number,
      username: row[1] as string,
      password: row[2] as string,
      createdAt: row[3] as string
    };

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Login successful:', user.id, user.username);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// DISCUSSION ROUTES
app.get('/api/discussions', (req, res) => {
  try {
    const db = getDatabase();

    // Get all discussions with user info
    const discussionsResult = db.exec(`
      SELECT d.id, d.userId, u.username, d.startNumber, d.createdAt 
      FROM discussions d 
      JOIN users u ON d.userId = u.id 
      ORDER BY d.createdAt DESC
    `);

    if (!discussionsResult.length || !discussionsResult[0].values.length) {
      console.log('No discussions found');
      return res.json([]);
    }

    const discussions: DiscussionWithComments[] = discussionsResult[0].values.map(row => ({
      id: row[0] as number,
      userId: row[1] as number,
      username: row[2] as string,
      startNumber: row[3] as number,
      createdAt: row[4] as string,
      comments: []
    }));

    console.log(`Found ${discussions.length} discussions`);

    // Get all comments for all discussions
    const commentsResult = db.exec(`
      SELECT c.id, c.discussionId, c.parentId, c.userId, u.username, c.operation, c.operand, c.result, c.createdAt 
      FROM comments c 
      JOIN users u ON c.userId = u.id 
      ORDER BY c.createdAt ASC
    `);

    if (commentsResult.length && commentsResult[0].values.length) {
      const allComments: Comment[] = commentsResult[0].values.map(row => ({
        id: row[0] as number,
        discussionId: row[1] as number,
        parentId: row[2] as number | null,
        userId: row[3] as number,
        username: row[4] as string,
        operation: row[5] as Operation,
        operand: row[6] as number,
        result: row[7] as number,
        createdAt: row[8] as string
      }));

      console.log(`Found ${allComments.length} comments`);

      // Group comments by discussion and build trees
      discussions.forEach(discussion => {
        const discussionComments = allComments.filter(c => c.discussionId === discussion.id);
        discussion.comments = buildCommentTree(discussionComments);
      });
    }

    res.json(discussions);
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ error: 'Failed to get discussions' });
  }
});

app.post('/api/discussions', authenticateToken, (req: any, res) => {
  try {
    const { startNumber } = req.body;
    const db = getDatabase();

    if (typeof startNumber !== 'number') {
      return res.status(400).json({ error: 'Start number must be a number' });
    }

    console.log('Creating discussion:', { startNumber, userId: req.user.id, username: req.user.username });

    // Verify user exists in database
    const userCheck = db.exec('SELECT id, username FROM users WHERE id = ?', [req.user.id]);
    if (!userCheck.length || !userCheck[0].values.length) {
      console.error('User not found in database:', req.user.id);
      return res.status(401).json({ error: 'User not found' });
    }

    const actualUsername = userCheck[0].values[0][1] as string;
    console.log('Verified user:', actualUsername);

    // Use executeInsert helper
    const discussionId = executeInsert('INSERT INTO discussions (userId, startNumber) VALUES (?, ?)', [req.user.id, startNumber]);
    saveDatabase();

    if (discussionId === 0) {
      console.error('Failed to get discussion ID');
      return res.status(500).json({ error: 'Failed to get discussion ID' });
    }
    
    console.log('Discussion created successfully with ID:', discussionId);

    // Get the full discussion with user info to ensure data consistency
    const fullDiscussion = db.exec(`
      SELECT d.id, d.userId, u.username, d.startNumber, d.createdAt 
      FROM discussions d 
      JOIN users u ON d.userId = u.id 
      WHERE d.id = ?
    `, [discussionId]);

    if (!fullDiscussion.length || !fullDiscussion[0].values.length) {
      console.error('Failed to fetch created discussion');
      return res.status(500).json({ error: 'Failed to fetch created discussion' });
    }

    const row = fullDiscussion[0].values[0];
    const discussion: DiscussionWithComments = {
      id: row[0] as number,
      userId: row[1] as number,
      username: row[2] as string,
      startNumber: row[3] as number,
      createdAt: row[4] as string,
      comments: []
    };

    console.log('Returning discussion:', discussion);
    res.json(discussion);
  } catch (error: any) {
    console.error('Create discussion error:', error);
    res.status(500).json({ error: error.message || 'Failed to create discussion' });
  }
});

// COMMENT ROUTES
app.post('/api/comments', authenticateToken, (req: any, res) => {
  try {
    const { discussionId, parentId, operation, operand } = req.body;
    const db = getDatabase();

    if (!discussionId || !operation || typeof operand !== 'number') {
      return res.status(400).json({ error: 'Invalid comment data' });
    }

    console.log('Creating comment:', { discussionId, parentId, operation, operand, userId: req.user.id });

    // Verify user exists
    const userCheck = db.exec('SELECT username FROM users WHERE id = ?', [req.user.id]);
    if (!userCheck.length || !userCheck[0].values.length) {
      return res.status(401).json({ error: 'User not found' });
    }
    const actualUsername = userCheck[0].values[0][0] as string;

    // Get the previous number
    let previousNumber: number;
    if (parentId) {
      const parentResult = db.exec('SELECT result FROM comments WHERE id = ?', [parentId]);
      if (!parentResult || !parentResult.length || !parentResult[0].values || !parentResult[0].values.length) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      previousNumber = parentResult[0].values[0][0] as number;
    } else {
      const discussionResult = db.exec('SELECT startNumber FROM discussions WHERE id = ?', [discussionId]);
      if (!discussionResult || !discussionResult.length || !discussionResult[0].values || !discussionResult[0].values.length) {
        return res.status(404).json({ error: 'Discussion not found' });
      }
      previousNumber = discussionResult[0].values[0][0] as number;
    }

    const result = calculateResult(previousNumber, operation as Operation, operand);

    const commentId = executeInsert(
      'INSERT INTO comments (discussionId, parentId, userId, operation, operand, result) VALUES (?, ?, ?, ?, ?, ?)',
      [discussionId, parentId || null, req.user.id, operation, operand, result]
    );
    saveDatabase();

    if (commentId === 0) {
      return res.status(500).json({ error: 'Failed to get comment ID' });
    }

    // Get the full comment with user info
    const fullComment = db.exec(`
      SELECT c.id, c.discussionId, c.parentId, c.userId, u.username, c.operation, c.operand, c.result, c.createdAt 
      FROM comments c 
      JOIN users u ON c.userId = u.id 
      WHERE c.id = ?
    `, [commentId]);

    if (!fullComment.length || !fullComment[0].values.length) {
      console.error('Failed to fetch created comment');
      return res.status(500).json({ error: 'Failed to fetch created comment' });
    }

    const row = fullComment[0].values[0];
    const comment: Comment = {
      id: row[0] as number,
      discussionId: row[1] as number,
      parentId: row[2] as number | null,
      userId: row[3] as number,
      username: row[4] as string,
      operation: row[5] as Operation,
      operand: row[6] as number,
      result: row[7] as number,
      createdAt: row[8] as string
    };

    console.log('Comment created successfully:', comment);
    res.json(comment);
  } catch (error: any) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create comment' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const db = getDatabase();
    const usersResult = db.exec('SELECT COUNT(*) as count FROM users');
    const discussionsResult = db.exec('SELECT COUNT(*) as count FROM discussions');
    const commentsResult = db.exec('SELECT COUNT(*) as count FROM comments');
    
    // Also show actual IDs to debug
    const userIds = db.exec('SELECT id, username FROM users');
    const discussionIds = db.exec('SELECT id, userId, startNumber FROM discussions');
    const commentIds = db.exec('SELECT id, discussionId FROM comments');
    
    res.json({
      status: 'ok',
      counts: {
        users: usersResult[0].values[0][0],
        discussions: discussionsResult[0].values[0][0],
        comments: commentsResult[0].values[0][0]
      },
      data: {
        users: userIds.length ? userIds[0].values : [],
        discussions: discussionIds.length ? discussionIds[0].values : [],
        comments: commentIds.length ? commentIds[0].values : []
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST /api/auth/register');
    console.log('  POST /api/auth/login');
    console.log('  GET  /api/discussions');
    console.log('  POST /api/discussions');
    console.log('  POST /api/comments');
    console.log('  GET  /api/health');
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});