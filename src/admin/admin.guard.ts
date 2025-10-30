import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>() as any;
    const hdr = req.headers['x-admin-key'];
    if (hdr && hdr === this.config.get<string>('ADMIN_API_KEY')) return true;
    throw new UnauthorizedException('Admin key required');
  }
}
