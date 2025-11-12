import React, { useState, useEffect } from 'react';
import { api } from './api';

interface User {
  id: number;
  username: string;
}

interface Comment {
  id: number;
  username: string;
  operation: string;
  operand: number;
  result: number;
  createdAt: string;
  children: Comment[];
}

interface Discussion {
  id: number;
  username: string;
  startNumber: number;
  createdAt: string;
  comments: Comment[];
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.id, username: payload.username });
        console.log('Logged in as:', payload.username, 'ID:', payload.id);
      } catch (err) {
        console.error('Invalid token:', err);
        localStorage.removeItem('token');
        setToken(null);
      }
    }
    loadDiscussions();
  }, [token]);

  const loadDiscussions = async () => {
    try {
      setLoading(true);
      console.log('Loading discussions...');
      const data = await api.getDiscussions();
      console.log('Loaded discussions:', data);
      setDiscussions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load discussions';
      console.error('Load discussions error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      console.log(`Attempting ${authMode}...`);
      const data = authMode === 'login' 
        ? await api.login(username, password)
        : await api.register(username, password);
      
      console.log('Auth successful:', data);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      setUsername('');
      setPassword('');
      
      // Reload discussions after login/register
      setTimeout(() => loadDiscussions(), 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      console.error('Auth error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    console.log('Logged out');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Number Discussion System</h1>
      
      <AuthSection 
        user={user}
        authMode={authMode}
        setAuthMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        error={error}
        handleAuth={handleAuth}
        handleLogout={handleLogout}
        loading={loading}
      />

      {user && token && (
        <NewDiscussionForm 
          token={token} 
          onDiscussionCreated={loadDiscussions} 
        />
      )}

      <DiscussionList 
        discussions={discussions}
        user={user}
        token={token}
        onCommentAdded={loadDiscussions}
        loading={loading}
        onRefresh={loadDiscussions}
      />
    </div>
  );
};

interface AuthSectionProps {
  user: User | null;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;
  error: string;
  handleAuth: (e: React.FormEvent) => void;
  handleLogout: () => void;
  loading: boolean;
}

const AuthSection: React.FC<AuthSectionProps> = ({ 
  user, authMode, setAuthMode, username, setUsername, 
  password, setPassword, error, handleAuth, handleLogout, loading
}) => {
  if (user) {
    return (
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
        <span>Logged in as: <strong>{user.username}</strong> (ID: {user.id})</span>
        <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
      <form onSubmit={handleAuth}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
          disabled={loading}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : (authMode === 'login' ? 'Login' : 'Register')}
        </button>
        <button 
          type="button" 
          onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          style={{ marginLeft: '10px' }}
          disabled={loading}
        >
          {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
        </button>
      </form>
      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
    </div>
  );
};

interface NewDiscussionFormProps {
  token: string;
  onDiscussionCreated: () => void;
}

const NewDiscussionForm: React.FC<NewDiscussionFormProps> = ({ 
  token, onDiscussionCreated 
}) => {
  const [startNumber, setStartNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const num = parseFloat(startNumber);
      console.log('Creating discussion with number:', num);
      const result = await api.createDiscussion(num, token);
      console.log('Discussion created:', result);
      setStartNumber('');
      onDiscussionCreated();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create discussion';
      console.error('Create discussion error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', background: '#e8f4f8', borderRadius: '5px' }}>
      <h3>Start New Discussion</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          step="any"
          placeholder="Starting number"
          value={startNumber}
          onChange={(e) => setStartNumber(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Start Discussion'}
        </button>
      </form>
      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
    </div>
  );
};

interface DiscussionListProps {
  discussions: Discussion[];
  user: User | null;
  token: string | null;
  onCommentAdded: () => void;
  loading: boolean;
  onRefresh: () => void;
}

const DiscussionList: React.FC<DiscussionListProps> = ({ 
  discussions, user, token, onCommentAdded, loading, onRefresh
}) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>All Discussions ({discussions.length})</h2>
        <button onClick={onRefresh} disabled={loading} style={{ padding: '5px 15px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {loading && discussions.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          Loading discussions...
        </div>
      ) : discussions.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          No discussions yet. {user ? 'Start one above!' : 'Login to start a discussion.'}
        </div>
      ) : (
        discussions.map((discussion) => (
          <DiscussionItem 
            key={discussion.id} 
            discussion={discussion}
            user={user}
            token={token}
            onCommentAdded={onCommentAdded}
          />
        ))
      )}
    </div>
  );
};

interface DiscussionItemProps {
  discussion: Discussion;
  user: User | null;
  token: string | null;
  onCommentAdded: () => void;
}

const DiscussionItem: React.FC<DiscussionItemProps> = ({ 
  discussion, user, token, onCommentAdded 
}) => {
  return (
    <div style={{ 
      marginBottom: '30px', 
      padding: '15px', 
      border: '2px solid #333', 
      borderRadius: '5px' 
    }}>
      <div style={{ marginBottom: '10px' }}>
        <strong>{discussion.username}</strong> started with: 
        <span style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginLeft: '10px',
          color: '#0066cc'
        }}>
          {discussion.startNumber}
        </span>
        <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
          {new Date(discussion.createdAt).toLocaleString()}
        </span>
      </div>
      
      {user && token && (
        <CommentForm 
          discussionId={discussion.id}
          parentId={null}
          previousNumber={discussion.startNumber}
          token={token}
          onCommentAdded={onCommentAdded}
        />
      )}

      {discussion.comments.length === 0 ? (
        <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
          No operations yet. {user ? 'Add the first one!' : 'Login to add operations.'}
        </div>
      ) : (
        discussion.comments.map((comment) => (
          <CommentTree 
            key={comment.id}
            comment={comment}
            discussionId={discussion.id}
            user={user}
            token={token}
            onCommentAdded={onCommentAdded}
            level={0}
          />
        ))
      )}
    </div>
  );
};

interface CommentTreeProps {
  comment: Comment;
  discussionId: number;
  user: User | null;
  token: string | null;
  onCommentAdded: () => void;
  level: number;
}

const CommentTree: React.FC<CommentTreeProps> = ({ 
  comment, discussionId, user, token, onCommentAdded, level 
}) => {
  const operationSymbol: Record<string, string> = {
    ADD: '+',
    SUBTRACT: '-',
    MULTIPLY: '×',
    DIVIDE: '÷'
  };

  return (
    <div style={{ marginLeft: `${level * 30}px`, marginTop: '10px' }}>
      <div style={{ 
        padding: '10px', 
        background: '#f9f9f9', 
        borderLeft: '3px solid #0066cc',
        marginBottom: '5px'
      }}>
        <div>
          <strong>{comment.username}</strong>: {operationSymbol[comment.operation] || comment.operation} {comment.operand} = 
          <span style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            marginLeft: '5px',
            color: '#0066cc'
          }}>
            {comment.result}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {new Date(comment.createdAt).toLocaleString()}
        </div>
      </div>

      {user && token && (
        <CommentForm 
          discussionId={discussionId}
          parentId={comment.id}
          previousNumber={comment.result}
          token={token}
          onCommentAdded={onCommentAdded}
        />
      )}

      {comment.children.map((child) => (
        <CommentTree 
          key={child.id}
          comment={child}
          discussionId={discussionId}
          user={user}
          token={token}
          onCommentAdded={onCommentAdded}
          level={level + 1}
        />
      ))}
    </div>
  );
};

interface CommentFormProps {
  discussionId: number;
  parentId: number | null;
  previousNumber: number;
  token: string;
  onCommentAdded: () => void;
}

const CommentForm: React.FC<CommentFormProps> = ({ 
  discussionId, parentId, previousNumber, token, onCommentAdded 
}) => {
  const [operation, setOperation] = useState('ADD');
  const [operand, setOperand] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const num = parseFloat(operand);
      console.log('Creating comment:', { discussionId, parentId, operation, operand: num });
      const result = await api.createComment(discussionId, parentId, operation, num, token);
      console.log('Comment created:', result);
      setOperand('');
      setShowForm(false);
      onCommentAdded();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create comment';
      console.error('Create comment error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button 
        onClick={() => setShowForm(true)}
        style={{ 
          marginTop: '5px', 
          padding: '5px 10px', 
          fontSize: '12px',
          background: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Add operation
      </button>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginTop: '5px', marginBottom: '10px' }}>
        <span style={{ marginRight: '5px' }}>{previousNumber}</span>
        <select 
          value={operation} 
          onChange={(e) => setOperation(e.target.value)}
          style={{ marginRight: '5px', padding: '3px' }}
          disabled={loading}
        >
          <option value="ADD">+</option>
          <option value="SUBTRACT">-</option>
          <option value="MULTIPLY">×</option>
          <option value="DIVIDE">÷</option>
        </select>
        <input
          type="number"
          step="any"
          placeholder="number"
          value={operand}
          onChange={(e) => setOperand(e.target.value)}
          style={{ marginRight: '5px', padding: '3px', width: '80px' }}
          disabled={loading}
          required
        />
        <button type="submit" style={{ marginRight: '5px', padding: '3px 8px' }} disabled={loading}>
          {loading ? 'Adding...' : 'Add'}
        </button>
        <button 
          type="button" 
          onClick={() => setShowForm(false)}
          style={{ padding: '3px 8px' }}
          disabled={loading}
        >
          Cancel
        </button>
      </form>
      {error && <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{error}</div>}
    </div>
  );
};

export default App;