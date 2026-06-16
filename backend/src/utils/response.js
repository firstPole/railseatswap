/**
 * Uniform success response wrapper.
 * All 2xx responses from the API use this shape:
 *   { success: true, data: <payload>, meta: <optional pagination etc> }
 */
export const sendSuccess = (res, data, statusCode = 200, meta = null) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendCreated = (res, data) => sendSuccess(res, data, 201);

/**
 * Wraps an async route handler so any thrown error is forwarded to the
 * global error handler without try/catch boilerplate in every controller.
 *
 * Usage:  router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
