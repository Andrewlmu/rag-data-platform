import rateLimit from 'express-rate-limit';

export const createRateLimiters = () => {
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many requests, please try again later.',
  });

  const queryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Query rate limit exceeded.',
  });

  const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: 'Upload rate limit exceeded.',
  });

  return { apiLimiter, queryLimiter, uploadLimiter };
};
