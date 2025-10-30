import { Response } from 'express';

export function setRefreshCookie(
  res: Response,
  token: string,
  opts: { domain: string; secure: boolean },
) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    domain: opts.domain || undefined,
    path: '/auth',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
}

export function clearRefreshCookie(
  res: Response,
  opts: { domain: string; secure: boolean },
) {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    domain: opts.domain || undefined,
    path: '/auth',
  });
}
