const { AppError, ConflictError, BadRequestError } = require('./appError');

function mapUnknownError(err) {
  // JSON 파싱 오류 처리
  if ((err instanceof SyntaxError && 'body' in err) || err.type === 'entity.parse.failed') {
    return new BadRequestError('요청 본문(JSON) 형식이 올바르지 않습니다.');
  }

  // MySQL 에러 매핑
  if (err && err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return new ConflictError('이미 존재하는 데이터입니다.');
      case 'ER_NO_REFERENCED_ROW_2':
      case 'ER_ROW_IS_REFERENCED_2':
        return new BadRequestError('요청 데이터의 참조 무결성이 올바르지 않습니다.');
      default:
        break;
    }
  }

  // 그 외 알 수 없는 서버 에러
  return new AppError('서버 내부 오류가 발생했습니다.', 500);
}

module.exports = function errorHandler(err, req, res, next) {
  const mapped = err instanceof AppError ? err : mapUnknownError(err);

  const status = mapped.statusCode || 500;
  const body = {
    success: false,
    message: mapped.message || '서버 내부 오류가 발생했습니다.',
  };

  // 개발 환경에서만 간단한 디버그 정보 포함
  if (process.env.NODE_ENV !== 'production') {
    body.path = req.originalUrl;
    body.method = req.method;
  }

  res.status(status).json(body);
};

