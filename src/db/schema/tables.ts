import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
  time,
  smallint,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import { baseModel } from './base';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('Role', ['OWNER', 'MANAGER', 'STAFF']);

export const bookingStatus = pgEnum('BookingStatus', [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'NO_SHOW',
  'COMPLETED',
]);

export const verificationType = pgEnum('VerificationType', [
  'EMAIL_VERIFY',
  'PASSWORD_RESET',
  'MAGIC_LINK',
  'TOTP_SETUP',
]);

export const sessionRevokedReason = pgEnum('SessionRevokedReason', [
  'rotated',
  'logout',
  'compromised',
  'admin',
]);

export const planEnum = pgEnum('Plan', ['TEST', 'TRIAL', 'FREE', 'PRO']);

export const subscriptionStatus = pgEnum('SubscriptionStatus', [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'canceled',
]);

export const signupKeys = pgTable(
  'SignupKey',
  {
    ...baseModel,
    codeHash: text('codeHash').notNull().unique(),
    label: text('label'),
    plan: planEnum('plan').notNull().default('TRIAL'),
    trialDays: integer('trialDays').notNull().default(14),
    maxUses: integer('maxUses').notNull().default(1),
    usedCount: integer('usedCount').notNull().default(0),
    emailDomain: text('emailDomain'),
    expiresAt: timestamp('expiresAt', { withTimezone: true }),
    allowMultipleBusinessesPerUser: boolean('allowMultipleBusinessesPerUser')
      .notNull()
      .default(true),
  },
  (t) => [index('signup_key_expires_idx').on(t.expiresAt)],
);

export const users = pgTable('User', {
  ...baseModel,
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('emailVerifiedAt', { withTimezone: true }),
  passwordHash: text('passwordHash'),
  twoFactorSecret: text('twoFactorSecret'),
  disabledAt: timestamp('disabledAt', { withTimezone: true }),
});

export const businesses = pgTable(
  'Business',
  {
    ...baseModel,
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    plan: planEnum('plan').notNull().default('TRIAL'),
    status: subscriptionStatus('status').notNull().default('trialing'),
    trialEndsAt: timestamp('trialEndsAt', { withTimezone: true }),
    planRenewsAt: timestamp('planRenewsAt', { withTimezone: true }),
    suspendedAt: timestamp('suspendedAt', { withTimezone: true }),
    limitsJson: jsonb('limitsJson'),
  },
  (t) => [uniqueIndex('business_slug_uq').on(t.slug)],
);

export const businessHours = pgTable(
  'BusinessHours',
  {
    ...baseModel,
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('dayOfWeek').notNull(),
    openTimeLocal: time('openTimeLocal').notNull(),
    closeTimeLocal: time('closeTimeLocal').notNull(),
  },
  (t) => [
    uniqueIndex('biz_hours_day_uq').on(t.businessId, t.dayOfWeek),
    check('biz_hours_day_ck', sql`${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6`),
    check('biz_hours_time_ck', sql`${t.openTimeLocal} < ${t.closeTimeLocal}`),
  ],
);

export const memberships = pgTable(
  'Membership',
  {
    ...baseModel,
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    disabledAt: timestamp('disabledAt', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('membership_user_business_uq').on(t.userId, t.businessId),
    index('membership_user_idx').on(t.userId),
    index('membership_business_idx').on(t.businessId),
  ],
);

export const membershipInvites = pgTable(
  'MembershipInvite',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    email: text('email').notNull(),
    role: roleEnum('role').notNull(),

    tokenHash: text('tokenHash').notNull().unique(),

    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('acceptedAt', { withTimezone: true }),
  },

  (t) => [
    uniqueIndex('invite_token_hash_uq').on(t.tokenHash),
    index('invite_business_email_idx').on(t.businessId, t.email),
    index('invite_business_expires_idx').on(t.businessId, t.expiresAt),
    index('invite_business_accepted_idx').on(t.businessId, t.acceptedAt),
  ],
);

export const services = pgTable(
  'Service',
  {
    ...baseModel,
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    priceCents: integer('priceCents').notNull().default(0),
    durationMin: integer('durationMin').notNull(),
    isActive: boolean('isActive').notNull().default(true),
    capacity: smallint('capacity').notNull().default(1),
    minLeadMinutes: integer('minLeadMinutes').notNull().default(0),
    maxAdvanceDays: integer('maxAdvanceDays').notNull().default(90),
    isPublic: boolean('isPublic').notNull().default(true),
  },
  (t) => [
    uniqueIndex('service_business_slug_uq').on(t.businessId, t.slug),
    index('service_business_idx').on(t.businessId),
  ],
);

export const staff = pgTable(
  'Staff',
  {
    ...baseModel,
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    bio: text('bio'),
    imageUrl: text('imageUrl'),
    color: text('color').default('#3b82f6'),
    displayOrder: integer('displayOrder').notNull().default(0),
    isActive: boolean('isActive').notNull().default(true),
  },
  (t) => [
    index('staff_business_idx').on(t.businessId),
    uniqueIndex('staff_business_email_uq').on(t.businessId, t.email),
    index('staff_user_idx').on(t.userId),
    uniqueIndex('staff_business_user_uq').on(t.businessId, t.userId),
  ],
);

export const staffServices = pgTable(
  'StaffService',
  {
    ...baseModel,
    staffId: uuid('staffId')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    isActive: boolean('isActive').notNull().default(true),
    isBookable: boolean('isBookable').notNull().default(true),
    priceCentsOverride: integer('priceCentsOverride'),
    durationMinOverride: integer('durationMinOverride'),
    bufferBeforeMin: integer('bufferBeforeMin').notNull().default(0),
    bufferAfterMin: integer('bufferAfterMin').notNull().default(0),
  },
  (t) => [
    uniqueIndex('staff_service_uq').on(t.staffId, t.serviceId),
    index('staff_service_staff_idx').on(t.staffId),
    index('staff_service_service_idx').on(t.serviceId),
  ],
);

export const staffAvailability = pgTable(
  'StaffAvailability',
  {
    ...baseModel,
    staffId: uuid('staffId')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('dayOfWeek').notNull(),
    startTimeLocal: time('startTimeLocal').notNull(),
    endTimeLocal: time('endTimeLocal').notNull(),
  },
  (t) => [
    index('staff_availability_staff_idx').on(t.staffId),
    uniqueIndex('staff_availability_block_uq').on(
      t.staffId,
      t.dayOfWeek,
      t.startTimeLocal,
    ),
    check(
      'staff_availability_day_ck',
      sql`${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6`,
    ),
    check(
      'staff_availability_time_ck',
      sql`${t.startTimeLocal} < ${t.endTimeLocal}`,
    ),
  ],
);

export const staffTimeOff = pgTable(
  'StaffTimeOff',
  {
    ...baseModel,
    staffId: uuid('staffId')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    startUtc: timestamp('startUtc', { withTimezone: true }).notNull(),
    endUtc: timestamp('endUtc', { withTimezone: true }).notNull(),
    reason: text('reason'),
  },
  (t) => [
    index('staff_timeoff_staff_idx').on(t.staffId),
    check('staff_timeoff_range_ck', sql`${t.startUtc} < ${t.endUtc}`),
  ],
);

export const sessions = pgTable(
  'Session',
  {
    ...baseModel,
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('userAgent'),
    ip: text('ip'),
    refreshTokenHash: text('refreshTokenHash').notNull(),
    revokedReason: sessionRevokedReason('revokedReason'),
    expiresAt: timestamp('expiresAt', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    revokedAt: timestamp('revokedAt', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('session_user_idx').on(t.userId),
    index('session_active_idx').on(t.userId, t.expiresAt),
  ],
);

export const verificationTokens = pgTable(
  'VerificationToken',
  {
    ...baseModel,
    userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }),
    type: verificationType('type').notNull(),
    tokenHash: text('tokenHash').notNull().unique(),
    sentTo: text('sentTo'),
    meta: text('meta'),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    usedAt: timestamp('usedAt', { withTimezone: true }),
  },
  (t) => [
    index('verification_type_idx').on(t.type),
    index('verification_user_idx').on(t.userId),
  ],
);

export const customers = pgTable(
  'Customer',
  {
    ...baseModel,
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    phoneE164: text('phoneE164'),
    marketingOptInAt: timestamp('marketingOptInAt', { withTimezone: true }),
    notes: text('notes'),
    tags: text('tags'),
  },
  (t) => [
    index('cust_biz_idx').on(t.businessId),
    uniqueIndex('cust_biz_email_uq').on(t.businessId, t.email),
    index('cust_biz_phone_idx').on(t.businessId, t.phoneE164),
  ],
);

export const bookings = pgTable(
  'Booking',
  {
    ...baseModel,
    businessId: uuid('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    staffId: uuid('staffId')
      .notNull()
      .references(() => staff.id, { onDelete: 'restrict' }),
    customerId: uuid('customerId').references(() => customers.id, {
      onDelete: 'set null',
    }),
    customerName: text('customerName').notNull(),
    customerEmail: text('customerEmail'),
    status: bookingStatus('status').notNull().default('PENDING'),
    startUtc: timestamp('startUtc', { withTimezone: true }).notNull(),
    endUtc: timestamp('endUtc', { withTimezone: true }).notNull(),
    notes: text('notes'),
    bookedPriceCents: integer('bookedPriceCents').notNull().default(0),
    bookedDurationMin: integer('bookedDurationMin').notNull().default(0),
    serviceSnapshotJson: jsonb('serviceSnapshotJson'),
    confirmedAt: timestamp('confirmedAt', { withTimezone: true }),
    cancelledAt: timestamp('cancelledAt', { withTimezone: true }),
    cancelReason: text('cancelReason'),
    noShowAt: timestamp('noShowAt', { withTimezone: true }),
    source: text('source').default('internal'),
    channelRef: text('channelRef'),
    paymentStatus: text('paymentStatus').default('unpaid'),
    depositCents: integer('depositCents').default(0),
  },
  (t) => [
    index('booking_business_idx').on(t.businessId),
    index('booking_staff_time_idx').on(t.staffId, t.startUtc, t.endUtc),
    index('booking_customer_idx').on(t.customerId),
  ],
);

export const bookingStatusHistory = pgTable(
  'BookingStatusHistory',
  {
    ...baseModel,
    bookingId: uuid('bookingId')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: bookingStatus('fromStatus'),
    toStatus: bookingStatus('toStatus').notNull(),
    changedByUserId: uuid('changedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
  },
  (t) => [index('book_hist_booking_idx').on(t.bookingId)],
);

export const outbox = pgTable(
  'Outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurredAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processedAt', { withTimezone: true }),
    attempts: smallint('attempts').notNull().default(0),
  },
  (t) => [index('outbox_topic_idx').on(t.topic)],
);

export const auditLog = pgTable(
  'AuditLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('businessId').references(() => businesses.id, {
      onDelete: 'cascade',
    }),
    actorUserId: uuid('actorUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entityId').notNull(),
    meta: jsonb('meta'),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('audit_biz_idx').on(t.businessId),
    index('audit_entity_idx').on(t.entity, t.entityId),
  ],
);
