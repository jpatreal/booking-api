import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const BusinessId = createParamDecorator(
  (_data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.params.businessId || req.headers['x-business-id'];
  },
);
