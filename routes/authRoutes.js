const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// JWT 로그인
router.post('/nonce', authController.requestNonce);
router.post('/verify-signature', authController.verifySignature);


// 사용자 인증 상태 조회
router.get('/status/:walletAddress', authController.getAuthStatus);

module.exports = router;
