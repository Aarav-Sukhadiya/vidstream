const { ZodError } = require('zod');

// Custom API Error helper class
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', fields = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handling middleware
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || err.status || 500;
  let code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  if (!(err instanceof AppError) && statusCode < 500 && code === 'INTERNAL_ERROR') {
    code = 'BAD_REQUEST';
  }
  let fields = err.fields;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION';
    message = 'Validation failed';
    fields = {};
    err.errors.forEach((issue) => {
      const fieldPath = issue.path.join('.') || 'root';
      fields[fieldPath] = issue.message;
    });
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Resource already exists';
    fields = err.keyValue;
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'VALIDATION';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION';
    message = 'Validation failed';
    fields = {};
    Object.keys(err.errors).forEach((key) => {
      fields[key] = err.errors[key].message;
    });
  }

  if (statusCode === 404 && !(err instanceof AppError)) {
    code = 'NOT_FOUND';
    message = 'Not found';
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'VALIDATION';
    message = 'Invalid JSON in request body';
  }

  // Payload too large from body parsers
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (statusCode >= 500) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[Error] ${req.method} ${req.originalUrl} -> ${statusCode} ${code}:`, err);
    }
    // Never leak internal error details to clients in production
    if (process.env.NODE_ENV === 'production') {
      code = 'INTERNAL_ERROR';
      message = 'An unexpected error occurred';
      fields = undefined;
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

module.exports = { errorHandler, AppError };
