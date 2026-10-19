export const websocketConfig = () => ({
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
});
