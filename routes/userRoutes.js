const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// 사용자 등록/로그인 (지갑 주소로)
router.post('/register', userController.registerUser);

// 사용자 정보 조회
router.get('/:walletAddress', userController.getUserByWallet);

// 사용자가 인증된 기관 목록 조회
router.get('/:walletAddress/organizations', userController.getUserOrganizations);

module.exports = router;
