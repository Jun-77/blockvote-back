const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { requireAuth, requireOrgAdminSelf } = require('../middlewares/auth');

// 투표 생성 (기관 관리자 전용) - JWT의 adminOrganizationId 사용
router.post('/', requireAuth, requireOrgAdminSelf, voteController.createVote);

// 모든 투표 목록 조회
router.get('/', voteController.getAllVotes);

// 특정 사용자 참여 가능 투표 목록
router.get('/available/:walletAddress', voteController.getAvailableVotes);

// 투표 상세
router.get('/:id', voteController.getVoteById);

// 투표 참여 (메타트랜잭션 시뮬레이션)
router.post('/:id/vote', voteController.submitVote);

// 투표 결과 조회
router.get('/:id/results', voteController.getVoteResults);

module.exports = router;
