import * as crypto from 'crypto';

export function sha256Base64(input: string) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function randomToken(length = 48) {
  return crypto.randomBytes(length).toString('base64url');
}
