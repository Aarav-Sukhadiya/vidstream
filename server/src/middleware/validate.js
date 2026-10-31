const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

function validate(source, schema) {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source] ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

const validateBody = (schema) => validate('body', schema);
const validateQuery = (schema) => validate('query', schema);
const validateParams = (schema) => validate('params', schema);

/**
 * Router.param handler rejecting malformed ObjectIds with a clean 400
 * before any controller or database work happens.
 */
function validateObjectIdParam(name) {
  return (req, res, next, value) => {
    if (!mongoose.isValidObjectId(value) || String(value).length !== 24) {
      return next(new AppError(`Invalid ${name}`, 400, 'VALIDATION'));
    }
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateObjectIdParam,
};
