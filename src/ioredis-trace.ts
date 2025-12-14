import Redis from 'ioredis';

const OriginalRedis: any = Redis;

function looksLikeLocalhost(arg: any) {
  if (arg == null) return true;
  if (typeof arg === 'string')
    return arg.includes('127.0.0.1') || arg.includes('localhost');
  if (typeof arg === 'object') {
    const host = arg.host ?? arg.hostname;
    return host === '127.0.0.1' || host === 'localhost';
  }
  return false;
}

const PatchedRedis: any = function (...args: any[]) {
  if (looksLikeLocalhost(args[0])) {
    console.error(
      '🚨 [REDIS-TRACE] Redis created with localhost/default:',
      args[0],
    );
    console.error(new Error('[REDIS-TRACE] stack').stack);
  }
  return new OriginalRedis(...args);
};

Object.assign(PatchedRedis, OriginalRedis);

(Redis as any) = PatchedRedis;
module.exports = PatchedRedis;
