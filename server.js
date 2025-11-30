const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 라우트 import
const userRoutes = require('./routes/userRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const voteRoutes = require('./routes/voteRoutes');
const authRoutes = require('./routes/authRoutes');

// 라우트 사용
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/auth', authRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ success: true, message: '블록체인 투표 API 서버' });
});

// 헬스체크 엔드포인트 (Docker healthcheck용)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 에러 핸들링 미들웨어
// 404 Not Found
const { NotFoundError } = require('./middlewares/appError');
app.use((req, res, next) => {
  next(new NotFoundError('요청하신 경로를 찾을 수 없습니다.'));
});

// Global Error Handler
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
