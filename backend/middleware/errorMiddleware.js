export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const isBadRequest = error.status === 400 || error.statusCode === 400;
  if ((error instanceof SyntaxError || error.name === 'SyntaxError') && isBadRequest) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body'
    });
  }

  if (
    error.name === 'ValidationError' ||
    error.name === 'CastError' ||
    isBadRequest
  ) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Email is already registered'
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}
