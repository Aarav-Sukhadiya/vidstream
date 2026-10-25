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
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
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

  // Helmet / CORS / JSON parse error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'VALIDATION';
    message = 'Invalid JSON in request body';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[Error] ${statusCode} ${code}:`, err);
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
