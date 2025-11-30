const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// 기관 등록 (전역 관리자 전용)
router.post('/register', requireAuth, requireAdmin, organizationController.registerOrganization);

// 기관 목록 조회
router.get('/', organizationController.getAllOrganizations);

// 내 관리 기관 목록 (/:id 보다 위에 있어야 함)
router.get('/mine', requireAuth, organizationController.getMyOrganizations);

// 특정 기관 조회
router.get('/:id', organizationController.getOrganizationById);

// 기관별 투표 목록 조회
router.get('/:id/votes', organizationController.getOrganizationVotes);

// 전역 관리자: 기관 관리자 지정/변경
router.patch('/:id/admin', requireAuth, requireAdmin, organizationController.updateOrganizationAdmin);

// 크레딧 충전 (기관 관리자)
router.post('/:id/credit', requireAuth, organizationController.addCredit);

module.exports = router;

