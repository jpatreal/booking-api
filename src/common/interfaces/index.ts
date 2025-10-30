export type JwtAccessPayload = {
  sub: string;
  email: string;
  mb?: { id: string; biz: string; role: 'OWNER' | 'MANAGER' | 'STAFF' } | null;
  ver?: number;
};
