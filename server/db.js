const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// AWS SDK Imports
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;
let ddbDocClient = null;

if (DYNAMODB_TABLE) {
  const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
}

// SQLite Local Fallback Setup
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'gallery.db');
let db = null;

if (!DYNAMODB_TABLE) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  db = new sqlite3.Database(DB_PATH);
}

function initDb() {
  if (DYNAMODB_TABLE) {
    console.log('DynamoDB integration active.');
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS gallery (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        seed INTEGER,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        filepath TEXT NOT NULL,
        style TEXT,
        user_id TEXT,
        created_at TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Failed to initialize database:', err);
        return reject(err);
      }

      // Migration: Add user_id column to existing table if it doesn't already exist
      db.run(`ALTER TABLE gallery ADD COLUMN user_id TEXT`, (alterErr) => {
        // Safe to ignore duplicate column error if user_id is already present
        console.log('Database initialized successfully.');
        resolve();
      });
    });
  });
}

function saveGeneration({ id, prompt, seed, width, height, filepath, style, userId }) {
  const createdAt = new Date().toISOString();
  if (DYNAMODB_TABLE && ddbDocClient) {
    const item = {
      userId: userId || "anonymous",
      id,
      prompt,
      seed: parseInt(seed),
      width: parseInt(width),
      height: parseInt(height),
      filepath,
      style,
      created_at: createdAt
    };
    return ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: item
    })).then(() => item);
  }

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO gallery (id, prompt, seed, width, height, filepath, style, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, prompt, seed, width, height, filepath, style, userId || null, createdAt], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, prompt, seed, width, height, filepath, style, user_id: userId, created_at: createdAt });
      }
    });
  });
}

function getAllGenerations(userId) {
  if (DYNAMODB_TABLE && ddbDocClient) {
    return ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId || "anonymous"
      },
      ScanIndexForward: false
    })).then(res => res.Items || []);
  }

  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM gallery WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC
    `, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getGenerationById(id) {
  if (DYNAMODB_TABLE && ddbDocClient) {
    return ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: "IdIndex",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id
      }
    })).then(res => res.Items && res.Items[0]);
  }

  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM gallery WHERE id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function deleteGeneration(id, userId) {
  if (DYNAMODB_TABLE && ddbDocClient) {
    return ddbDocClient.send(new DeleteCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        userId: userId || "anonymous",
        id
      }
    })).then(res => true);
  }

  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM gallery WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `, [id, userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

module.exports = {
  initDb,
  saveGeneration,
  getAllGenerations,
  getGenerationById,
  deleteGeneration
};
