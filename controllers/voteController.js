const db = require('../config/database');
const { BadRequestError, NotFoundError, ConflictError } = require('../middlewares/appError');

// 투표 생성
exports.createVote = async (req, res, next) => {
  try {
    const {
      title,
      description,
      network,
      startTime,
      endTime,
      options,
      imageUrl,
      contractAddress
    } = req.body;

    const organizationId = req.user?.adminOrganizationId;
    if (!organizationId || !title || !network || !startTime || !endTime || !options) {
      return next(new BadRequestError('필수 입력 값이 누락되었습니다.')); // orgId는 JWT에서 가져옵니다.
    }

    // 투표 생성
    const [result] = await db.query(
      `INSERT INTO votes (organization_id, contract_address, title, description,
       image_url, network, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        organizationId,
        contractAddress || '0x0000000000000000000000000000000000000000',
        title,
        description || '',
        imageUrl || '',
        network,
        startTime,
        endTime
      ]
    );

    const voteId = result.insertId;

    // 투표 옵션 생성
    for (let i = 0; i < options.length; i++) {
      await db.query(
        'INSERT INTO vote_options (vote_id, option_name, option_index) VALUES (?, ?, ?)',
        [voteId, options[i], i]
      );
    }

    const [vote] = await db.query('SELECT * FROM votes WHERE id = ?', [voteId]);
    const [voteOptions] = await db.query('SELECT * FROM vote_options WHERE vote_id = ?', [voteId]);

    res.status(201).json({
      success: true,
      message: '투표가 성공적으로 생성되었습니다.',
      data: { vote: vote[0], options: voteOptions }
    });
  } catch (error) {
    console.error('Error creating vote:', error);
    next(error);
  }
};

// 모든 투표 목록 조회
exports.getAllVotes = async (req, res, next) => {
  try {
    const [votes] = await db.query(`
      SELECT v.*, o.name as organization_name
      FROM votes v
      LEFT JOIN organizations o ON v.organization_id = o.id
      ORDER BY v.created_at DESC
    `);

    // 각 투표에 대한 옵션과 참여자 수 조회
    for (let vote of votes) {
      const [options] = await db.query(
        'SELECT * FROM vote_options WHERE vote_id = ?',
        [vote.id]
      );

      const [transactions] = await db.query(
        'SELECT COUNT(*) as count FROM transactions WHERE vote_id = ?',
        [vote.id]
      );

      vote.options = options;
      vote.participated = transactions[0].count;
    }

    res.json({ success: true, data: { votes } });
  } catch (error) {
    console.error('Error getting votes:', error);
    next(error);
  }
};

// 특정 사용자가 참여 가능한 투표 목록
exports.getAvailableVotes = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    // 사용자 ID 조회
    const [users] = await db.query(
      'SELECT id FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    let userId = null;
    if (users.length > 0) {
      userId = users[0].id;
    }

    // 블록체인 연결 전: 모든 active 투표를 보여줌
    // TODO: 블록체인 연결 후에는 user_tokens로 필터링
    let votes;
    if (userId) {
      [votes] = await db.query(`
        SELECT v.*, o.name as organization_name,
        (SELECT COUNT(*) FROM transactions WHERE vote_id = v.id AND user_id = ?) as has_voted,
        (SELECT COUNT(*) FROM transactions WHERE vote_id = v.id) as participated
        FROM votes v
        LEFT JOIN organizations o ON v.organization_id = o.id
        WHERE v.status = 'active'
        ORDER BY v.created_at DESC
      `, [userId]);
    } else {
      [votes] = await db.query(`
        SELECT v.*, o.name as organization_name,
        0 as has_voted,
        (SELECT COUNT(*) FROM transactions WHERE vote_id = v.id) as participated
        FROM votes v
        LEFT JOIN organizations o ON v.organization_id = o.id
        WHERE v.status = 'active'
        ORDER BY v.created_at DESC
      `);
    }

    // 각 투표에 대한 옵션 조회
    for (let vote of votes) {
      const [options] = await db.query(
        'SELECT * FROM vote_options WHERE vote_id = ?',
        [vote.id]
      );
      vote.options = options;
      vote.hasVoted = vote.has_voted > 0;
      vote.hasAccess = true;
    }

    res.json({ success: true, data: { votes } });
  } catch (error) {
    console.error('Error getting available votes:', error);
    next(error);
  }
};

// 투표 상세 정보
exports.getVoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    const [votes] = await db.query(`
      SELECT v.*, o.name as organization_name
      FROM votes v
      LEFT JOIN organizations o ON v.organization_id = o.id
      WHERE v.id = ?
    `, [id]);

    if (votes.length === 0) {
      return next(new NotFoundError('투표를 찾을 수 없습니다.'));
    }

    const vote = votes[0];

    // 옵션 조회
    const [options] = await db.query(
      'SELECT * FROM vote_options WHERE vote_id = ?',
      [id]
    );

    // 총 참여자 수
    const [transactions] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE vote_id = ?',
      [id]
    );

    vote.options = options;
    vote.participated = transactions[0].count;

    // 사용자가 투표했는지 확인
    if (walletAddress) {
      const [users] = await db.query(
        'SELECT id FROM users WHERE wallet_address = ?',
        [walletAddress]
      );

      if (users.length > 0) {
        const [userVotes] = await db.query(
          'SELECT * FROM transactions WHERE vote_id = ? AND user_id = ?',
          [id, users[0].id]
        );
        vote.hasVoted = userVotes.length > 0;

        // 접근 권한 확인
        const [access] = await db.query(
          'SELECT * FROM user_tokens WHERE user_id = ? AND organization_id = ? AND token_minted = TRUE',
          [users[0].id, vote.organization_id]
        );
        vote.hasAccess = access.length > 0;
      }
    }

    res.json({ success: true, data: { vote } });
  } catch (error) {
    console.error('Error getting vote:', error);
    next(error);
  }
};

// 투표 참여 (서명 제출)
exports.submitVote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, optionIndex, signature } = req.body;

    if (!walletAddress || optionIndex === undefined || !signature) {
      return next(new BadRequestError('필수 입력 값이 누락되었습니다.'));
    }

    // 사용자 조회
    const [users] = await db.query(
      'SELECT id FROM users WHERE wallet_address = ?',
      [walletAddress]
    );

    if (users.length === 0) {
      return next(new NotFoundError('사용자를 찾을 수 없습니다.'));
    }

    const userId = users[0].id;

    // 이미 투표했는지 확인
    const [existingVotes] = await db.query(
      'SELECT * FROM transactions WHERE vote_id = ? AND user_id = ?',
      [id, userId]
    );

    if (existingVotes.length > 0) {
      return next(new ConflictError('이미 투표를 완료했습니다.'));
    }

    // 투표 기록 생성 (실제로는 여기서 메타 트랜잭션 처리)
    const txHash = '0x' + require('crypto').randomBytes(32).toString('hex');

    await db.query(
      `INSERT INTO transactions (vote_id, user_id, option_index, tx_hash, status)
       VALUES (?, ?, ?, ?, 'confirmed')`,
      [id, userId, optionIndex, txHash]
    );

    // 투표 옵션 카운트 증가
    await db.query(
      'UPDATE vote_options SET votes_count = votes_count + 1 WHERE vote_id = ? AND option_index = ?',
      [id, optionIndex]
    );

    res.json({
      success: true,
      message: '투표가 성공적으로 제출되었습니다.',
      data: { txHash }
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    next(error);
  }
};

// 투표 결과 조회
exports.getVoteResults = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [vote] = await db.query('SELECT * FROM votes WHERE id = ?', [id]);

    if (vote.length === 0) {
      return next(new NotFoundError('투표를 찾을 수 없습니다.'));
    }

    const [options] = await db.query(
      'SELECT * FROM vote_options WHERE vote_id = ? ORDER BY option_index',
      [id]
    );

    const totalVotes = options.reduce((sum, option) => sum + option.votes_count, 0);

    const results = options.map(option => ({
      ...option,
      percentage: totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0
    }));

    res.json({
      success: true,
      data: { vote: vote[0], results, totalVotes }
    });
  } catch (error) {
    console.error('Error getting vote results:', error);
    next(error);
  }
};
