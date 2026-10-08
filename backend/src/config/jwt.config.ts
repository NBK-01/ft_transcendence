export const jwtConfig = () => ({
  secret: process.env.JWT_SECRET || 'dev-only-insecure-default-change-me',
  accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
});
