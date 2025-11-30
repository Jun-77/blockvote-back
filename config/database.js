const mysql = require('mysql2');
require('dotenv').config();

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blockchain_voting',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Promise 기반으로 사용하기 위해 promise() 사용
const promisePool = pool.promise();

module.exports = promisePool;
