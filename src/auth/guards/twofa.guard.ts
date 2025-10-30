import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TwofaGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { twofaPassed?: boolean };
    if (user?.twofaPassed) return true;
    throw new ForbiddenException('2FA required');
  }
}
