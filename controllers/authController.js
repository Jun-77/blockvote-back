const db = require('../config/database');
const { BadRequestError, NotFoundError } = require('../middlewares/appError');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyMessage } = require('ethers');

// 사용자 인증 상태 조회
exports.getAuthStatus = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    // 사용자 조회
    const [users] = await db.query(
      'SELECT id FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    if (users.length === 0) {
      return res.json({ organizations: [] });
    }

    const userId = users[0].id;

    // 인증된 기관 목록 조회
    const [organizations] = await db.query(`
      SELECT o.*, ut.token_minted, ut.approved_at,
      CASE
        WHEN ut.token_minted = TRUE THEN 'approved'
        ELSE 'pending'
      END as status
      FROM organizations o
      JOIN user_tokens ut ON o.id = ut.organization_id
      WHERE ut.user_id = ?
      ORDER BY ut.approved_at DESC
    `, [userId]);

    res.json({ success: true, data: { organizations } });
  } catch (error) {
    console.error('Error getting auth status:', error);
    next(error);
  }
};

// 로그인용 노스 발급
exports.requestNonce = async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address) return next(new BadRequestError('지갑 주소가 필요합니다.'));

    // 사용자 생성 혹은 조회
    let [users] = await db.query('SELECT * FROM users WHERE wallet_address = ?', [address]);
    let userId;
    if (users.length === 0) {
      const [result] = await db.query('INSERT INTO users (wallet_address, is_admin) VALUES (?, FALSE)', [address]);
      userId = result.insertId;
    } else {
      userId = users[0].id;
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    await db.query('UPDATE users SET login_nonce = ? WHERE id = ?', [nonce, userId]);

    res.json({ success: true, data: { nonce, message: `Sign this message to login: ${nonce}` } });
  } catch (error) {
    console.error('Error requesting nonce:', error);
    next(error);
  }
};

// 서명 검증 후 JWT 발급
exports.verifySignature = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;
    if (!address || !signature || !message) {
      return next(new BadRequestError('주소, 서명, 메시지가 필요합니다.'));
    }

    // 복원된 주소 비교
    const recovered = verifyMessage(message, signature);
    if (!recovered || recovered.toLowerCase() !== address.toLowerCase()) {
      return next(new BadRequestError('서명 검증에 실패했습니다.'));
    }

    const [users] = await db.query('SELECT id, is_admin, login_nonce, admin_organization_id FROM users WHERE wallet_address = ?', [address]);
    if (users.length === 0) return next(new NotFoundError('사용자를 찾을 수 없습니다.'));

    // 메시지 내 포함된 nonce 일치 여부 확인
    const nonce = users[0].login_nonce;
    if (!nonce || !message.includes(nonce)) {
      return next(new BadRequestError('유효하지 않은 로그인 요청입니다.'));
    }

    // 일회성 사용을 위해 nonce 제거
    await db.query('UPDATE users SET login_nonce = NULL WHERE id = ?', [users[0].id]);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('JWT secret is not configured'));
    }

    const token = jwt.sign(
      { address, isAdmin: !!users[0].is_admin, adminOrganizationId: users[0].admin_organization_id || null },
      secret,
      { subject: String(users[0].id), expiresIn: '1d' }
    );

    res.json({ success: true, message: '로그인에 성공했습니다.', data: { token, user: { id: users[0].id, address, isAdmin: !!users[0].is_admin, adminOrganizationId: users[0].admin_organization_id || null } } });
  } catch (error) {
    console.error('Error verifying signature:', error);
    next(error);
  }
};
