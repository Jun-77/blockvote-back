const jwt = require('jsonwebtoken');
const db = require('../config/database');

function getTokenFromHeader(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'JWT secret is not configured' });
    }
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.sub, address: payload.address, isAdmin: !!payload.isAdmin, adminOrganizationId: payload.adminOrganizationId || null };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
  if (!req.user.isAdmin) {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };

// 조직별 관리자 확인 (경로 파라미터로 조직 ID 추출)
async function requireOrgAdminByParam(param = 'id', req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const orgId = req.params[param];
    if (!orgId) return res.status(400).json({ success: false, message: '조직 ID가 필요합니다.' });
    if (String(req.user.adminOrganizationId || '') !== String(orgId)) {
      return res.status(403).json({ success: false, message: '기관 관리자 권한이 필요합니다.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// 조직별 관리자 확인 (요청 본문으로 조직 ID 추출)
async function requireOrgAdminByBody(field = 'organizationId', req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const orgId = req.body?.[field];
    if (!orgId) return res.status(400).json({ success: false, message: '조직 ID가 필요합니다.' });
    if (String(req.user.adminOrganizationId || '') !== String(orgId)) {
      return res.status(403).json({ success: false, message: '기관 관리자 권한이 필요합니다.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// 자신의 기관 관리자 여부만 확인 (orgId는 JWT에서 추출)
function requireOrgAdminSelf(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
  if (!req.user.adminOrganizationId) return res.status(403).json({ success: false, message: '기관 관리자 권한이 필요합니다.' });
  next();
}

// Express 미들웨어 래퍼
function orgAdminByParam(param = 'id') {
  return (req, res, next) => requireOrgAdminByParam(param, req, res, next);
}
function orgAdminByBody(field = 'organizationId') {
  return (req, res, next) => requireOrgAdminByBody(field, req, res, next);
}

module.exports.requireOrgAdminByParam = orgAdminByParam;
module.exports.requireOrgAdminByBody = orgAdminByBody;
module.exports.requireOrgAdminSelf = requireOrgAdminSelf;
