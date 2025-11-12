import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: SqlJsDatabase;
const DB_PATH = path.join(__dirname, '../data/discussions.db');

export const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      startNumber REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discussionId INTEGER NOT NULL,
      parentId INTEGER,
      userId INTEGER NOT NULL,
      operation TEXT NOT NULL,
      operand REAL NOT NULL,
      result REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discussionId) REFERENCES discussions(id),
      FOREIGN KEY (parentId) REFERENCES comments(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  saveDatabase();
  return db;
};

export const saveDatabase = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
};

export const getDatabase = () => db;

// Helper function to execute insert and return the id
export const executeInsert = (sql: string, params: any[]): number => {
  try {
    console.log('Executing INSERT:', sql, 'with params:', params);
    
    // Get the table name to query max ID before insert
    const tableName = sql.match(/INSERT INTO (\w+)/)?.[1];
    console.log('Table name:', tableName);
    
    // Get current max ID before insert
    let maxIdBefore = 0;
    if (tableName) {
      const beforeResult = db.exec(`SELECT COALESCE(MAX(id), 0) as maxId FROM ${tableName}`);
      if (beforeResult && beforeResult.length > 0 && beforeResult[0].values && beforeResult[0].values.length > 0) {
        maxIdBefore = beforeResult[0].values[0][0] as number;
        console.log('Max ID before insert:', maxIdBefore);
      }
    }
    
    // Execute the insert
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    
    // Save database immediately
    saveDatabase();
    
    // Get the new max ID after insert
    if (tableName) {
      const afterResult = db.exec(`SELECT MAX(id) as maxId FROM ${tableName}`);
      if (afterResult && afterResult.length > 0 && afterResult[0].values && afterResult[0].values.length > 0) {
        const maxIdAfter = afterResult[0].values[0][0] as number;
        console.log('Max ID after insert:', maxIdAfter);
        
        if (maxIdAfter > maxIdBefore) {
          console.log('Successfully inserted with ID:', maxIdAfter);
          return maxIdAfter;
        }
      }
    }
    
    console.error('Failed to get valid ID after insert');
    return 0;
  } catch (error) {
    console.error('executeInsert error:', error);
    throw error;
  }
};