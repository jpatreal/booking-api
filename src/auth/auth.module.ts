import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokensService } from './tokens.service';
import { OauthService } from './oauth.service';
import { MailerService } from './mailer.service';
import { TwofaService } from './twofa.service';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { SessionsRepository } from './sessions.repository';
import { MembershipInviteService } from '@app/memberships/membership-invite.service';
import { MembershipsModule } from '@app/memberships/memberships.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    MembershipsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    OauthService,
    MailerService,
    TwofaService,
    LocalStrategy,
    JwtAccessStrategy,
    GoogleStrategy,
    SessionsRepository,
    MembershipInviteService,
  ],
  exports: [JwtModule, MailerService],
})
export class AuthModule {}
