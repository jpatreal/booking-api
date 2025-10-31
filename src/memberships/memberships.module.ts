import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './memberships.repository';
import { BusinessesRepository } from '@app/businesses/businesses.repository';
import { UserRepository } from '@app/users/user.repository';
import { MembershipInviteService } from './membership-invite.service';
import { MembershipInviteRepository } from './membership-invite.repository';
import { MembershipInvitesController } from './membership-invite.controller';
import { MailerService } from '@app/auth/mailer.service';

@Module({
  providers: [
    MembershipsService,
    MembershipsRepository,
    BusinessesRepository,
    UserRepository,
    MembershipInviteService,
    MembershipInviteRepository,
    MailerService,
  ],
  controllers: [MembershipsController, MembershipInvitesController],
  exports: [
    MembershipsService,
    MembershipInviteService,
    MembershipInviteRepository,
  ],
})
export class MembershipsModule {}
