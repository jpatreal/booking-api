import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.membership || null;
  },
);
