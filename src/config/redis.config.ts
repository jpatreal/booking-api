import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const url =
    process.env.REDIS_URL || 'redis://default:devpass@localhost:6379/0';
  return { url };
});
