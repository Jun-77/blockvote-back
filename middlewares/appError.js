class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = statusCode >= 400 && statusCode < 500;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = '잘못된 요청입니다.', details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '인증이 필요합니다.', details = null) {
    super(message, 401, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = '접근이 허용되지 않습니다.', details = null) {
    super(message, 403, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = '요청하신 리소스를 찾을 수 없습니다.', details = null) {
    super(message, 404, details);
  }
}

class ConflictError extends AppError {
  constructor(message = '이미 존재하는 데이터입니다.', details = null) {
    super(message, 409, details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};

