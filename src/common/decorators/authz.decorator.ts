import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { REQ_AUTHZ_KEY } from '../constants/authz.constants';
export const Authz = createParamDecorator((_d, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req[REQ_AUTHZ_KEY];
});
