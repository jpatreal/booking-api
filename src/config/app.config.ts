import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    env: process.env.NODE_ENV ?? 'development',
    name: process.env.APP_NAME ?? 'booking-api',
    port: parseInt(process.env.PORT ?? '4000', 10),
    cors: {
      origins,
    },
  } as const;
});
