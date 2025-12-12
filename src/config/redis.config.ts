import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_URL is required in production');
    }
    return { url: 'redis://:devpass@localhost:6379/0' };
  }

  return { url };
});
