const db = require('../config/database');
const { BadRequestError, NotFoundError } = require('../middlewares/appError');

// 기관 등록
exports.registerOrganization = async (req, res, next) => {
  try {
    const { name, businessNumber, adminAddress } = req.body;

    if (!name || !adminAddress) {
      return next(new BadRequestError('이름과 관리자 지갑 주소가 필요합니다.'));
    }

    // 지갑 주소 검증
    if (!/^0x[a-fA-F0-9]{40}$/.test(adminAddress)) {
      return next(new BadRequestError('유효한 이더리움 지갑 주소가 아닙니다.'));
    }

    // 기관 생성
    const [result] = await db.query(
      'INSERT INTO organizations (name, business_number, admin_address) VALUES (?, ?, ?)',
      [name, businessNumber || null, adminAddress]
    );

    const organizationId = result.insertId;

    // 해당 지갑 주소를 가진 사용자를 찾거나 생성
    let [users] = await db.query('SELECT id, is_admin FROM users WHERE wallet_address = ?', [adminAddress]);
    let userId;

    if (users.length === 0) {
      // 사용자가 없으면 생성 (is_admin=TRUE, admin_organization_id=새로 생성된 기관 ID)
      const [userResult] = await db.query(
        'INSERT INTO users (wallet_address, is_admin, admin_organization_id) VALUES (?, TRUE, ?)',
        [adminAddress, organizationId]
      );
      userId = userResult.insertId;
    } else {
      // 사용자가 이미 있으면 is_admin=TRUE, admin_organization_id 업데이트
      userId = users[0].id;
      await db.query(
        'UPDATE users SET is_admin = TRUE, admin_organization_id = ? WHERE id = ?',
        [organizationId, userId]
      );
    }

    const [organization] = await db.query(
      'SELECT * FROM organizations WHERE id = ?',
      [organizationId]
    );

    res.status(201).json({
      success: true,
      message: '기관이 성공적으로 등록되었습니다.',
      data: { organization: organization[0] }
    });
  } catch (error) {
    console.error('Error registering organization:', error);
    next(error);
  }
};

// 모든 기관 조회
exports.getAllOrganizations = async (req, res, next) => {
  try {
    const [organizations] = await db.query('SELECT * FROM organizations');
    res.json({ success: true, data: { organizations } });
  } catch (error) {
    console.error('Error getting organizations:', error);
    next(error);
  }
};

// 특정 기관 조회
exports.getOrganizationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [organizations] = await db.query(
      'SELECT * FROM organizations WHERE id = ?',
      [id]
    );

    if (organizations.length === 0) {
      return next(new NotFoundError('기관을 찾을 수 없습니다.'));
    }

    res.json({ success: true, data: { organization: organizations[0] } });
  } catch (error) {
    console.error('Error getting organization:', error);
    next(error);
  }
};

// 기관별 투표 목록 조회
exports.getOrganizationVotes = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [votes] = await db.query(
      'SELECT * FROM votes WHERE organization_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({ success: true, data: { votes } });
  } catch (error) {
    console.error('Error getting organization votes:', error);
    next(error);
  }
};

// 내 관리 기관 목록 조회 (JWT의 address 기반)
exports.getMyOrganizations = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    const [rows] = await db.query('SELECT admin_organization_id FROM users WHERE id = ?', [userId]);
    if (rows.length === 0 || !rows[0].admin_organization_id) {
      return res.json({ success: true, data: { organizations: [] } });
    }
    const orgId = rows[0].admin_organization_id;
    const [organizations] = await db.query('SELECT * FROM organizations WHERE id = ?', [orgId]);
    res.json({ success: true, data: { organizations } });
  } catch (error) {
    console.error('Error getting my organizations:', error);
    next(error);
  }
};

// 기관 관리자 지갑 주소 변경 (전역 관리자 전용)
exports.updateOrganizationAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminAddress } = req.body;

    if (!adminAddress) {
      return next(new BadRequestError('관리자 지갑 주소가 필요합니다.'));
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(adminAddress)) {
      return next(new BadRequestError('유효한 이더리움 지갑 주소가 아닙니다.'));
    }

    const [orgs] = await db.query('SELECT id FROM organizations WHERE id = ?', [id]);
    if (orgs.length === 0) {
      return next(new NotFoundError('기관을 찾을 수 없습니다.'));
    }

    // 해당 지갑 사용자를 찾거나 생성
    let [users] = await db.query('SELECT id FROM users WHERE wallet_address = ?', [adminAddress]);
    let userId;
    if (users.length === 0) {
      const [result] = await db.query('INSERT INTO users (wallet_address, is_admin, admin_organization_id) VALUES (?, TRUE, ?)', [adminAddress, id]);
      userId = result.insertId;
    } else {
      userId = users[0].id;
    }

    await db.query('UPDATE users SET is_admin = TRUE, admin_organization_id = ? WHERE id = ?', [id, userId]);
    const [organization] = await db.query('SELECT * FROM organizations WHERE id = ?', [id]);

    res.json({ success: true, message: '기관 관리자 설정이 반영되었습니다.', data: { organization: organization[0] } });
  } catch (error) {
    console.error('Error updating organization admin:', error);
    next(error);
  }
};

// 크레딧 충전 (기관 관리자)
exports.addCredit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return next(new BadRequestError('유효한 충전 금액을 입력해주세요.'));
    }

    // 기관 존재 확인
    const [orgs] = await db.query('SELECT * FROM organizations WHERE id = ?', [id]);
    if (orgs.length === 0) {
      return next(new NotFoundError('기관을 찾을 수 없습니다.'));
    }

    // 크레딧 추가 (블록체인 연결 전 더미)
    await db.query(
      'UPDATE organizations SET credit_balance = credit_balance + ? WHERE id = ?',
      [amount, id]
    );

    const [updated] = await db.query('SELECT * FROM organizations WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `${amount} ETH가 충전되었습니다.`,
      data: { organization: updated[0] }
    });
  } catch (error) {
    console.error('Error adding credit:', error);
    next(error);
  }
};
