const fs = require('fs');
const path = require('path');
const config = require('../config');

class Database {
  constructor() {
    this.filePath = path.resolve(process.cwd(), config.storage.dbFilePath);
    this.data = {
      users: [],
      subscriptions: [],
      payments: [],
      scans: [],
      smsLogs: []
    };
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn(`[Database] Initialized in-memory fallback: ${err.message}`);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database Save Error]', err);
    }
  }

  // Generic helpers
  find(collection, predicate) {
    if (!this.data[collection]) return [];
    return this.data[collection].filter(predicate);
  }

  findOne(collection, predicate) {
    if (!this.data[collection]) return null;
    return this.data[collection].find(predicate) || null;
  }

  insert(collection, item) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    const record = {
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data[collection].push(record);
    this.save();
    return record;
  }

  update(collection, predicate, updates) {
    if (!this.data[collection]) return null;
    const index = this.data[collection].findIndex(predicate);
    if (index === -1) return null;

    this.data[collection][index] = {
      ...this.data[collection][index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data[collection][index];
  }

  getAll(collection) {
    return this.data[collection] || [];
  }
}

const db = new Database();
module.exports = db;
