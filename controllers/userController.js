const db = require('../config/database');
const { BadRequestError, NotFoundError } = require('../middlewares/appError');

// 사용자 등록 또는 로그인
exports.registerUser = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return next(new BadRequestError('지갑 주소가 필요합니다.'));
    }

    // 이미 존재하는 사용자인지 확인
    const [existingUsers] = await db.query(
      'SELECT * FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    if (existingUsers.length > 0) {
      return res.json({
        success: true,
        message: '이미 등록된 사용자입니다.',
        data: { user: existingUsers[0] }
      });
    }

    // 새 사용자 생성
    const [result] = await db.query(
      'INSERT INTO users (wallet_address, is_admin) VALUES (?, FALSE)',
      [walletAddress]
    );

    const [newUser] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: { user: newUser[0] }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    next(error);
  }
};

// 지갑 주소로 사용자 조회
exports.getUserByWallet = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    const [users] = await db.query(
      'SELECT * FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    if (users.length === 0) {
      return next(new NotFoundError('사용자를 찾을 수 없습니다.'));
    }

    res.json({ success: true, data: { user: users[0] } });
  } catch (error) {
    console.error('Error getting user:', error);
    next(error);
  }
};

// 사용자가 인증된 기관 목록 조회
exports.getUserOrganizations = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    // 먼저 사용자 ID 조회
    const [users] = await db.query(
      'SELECT id FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    if (users.length === 0) {
      return next(new NotFoundError('사용자를 찾을 수 없습니다.'));
    }

    const userId = users[0].id;

    // 사용자가 인증된 기관 목록 조회
    const [organizations] = await db.query(
      `SELECT o.*, ut.token_minted, ut.approved_at
       FROM organizations o
       JOIN user_tokens ut ON o.id = ut.organization_id
       WHERE ut.user_id = ?`,
      [userId]
    );

    res.json({ success: true, data: { organizations } });
  } catch (error) {
    console.error('Error getting user organizations:', error);
    next(error);
  }
};
