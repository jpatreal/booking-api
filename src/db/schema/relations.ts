import { relations } from 'drizzle-orm';
import {
  users,
  businesses,
  businessHours,
  memberships,
  services,
  staff,
  staffServices,
  staffAvailability,
  staffTimeOff,
  customers,
  bookings,
  bookingStatusHistory,
  sessions,
  verificationTokens,
} from './tables';

// -------- Users --------
export const userRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
  tokens: many(verificationTokens),
  bookingStatusChanges: many(bookingStatusHistory, {
    relationName: 'BookingStatusChangedByUser',
  }),
}));

// -------- Businesses --------
export const businessRelations = relations(businesses, ({ many }) => ({
  memberships: many(memberships),
  services: many(services),
  staff: many(staff),
  bookings: many(bookings),
  hours: many(businessHours),
  customers: many(customers),
}));

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  business: one(businesses, {
    fields: [businessHours.businessId],
    references: [businesses.id],
  }),
}));

// -------- Memberships --------
export const membershipRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [memberships.businessId],
    references: [businesses.id],
  }),
}));

// -------- Services --------
export const serviceRelations = relations(services, ({ one, many }) => ({
  business: one(businesses, {
    fields: [services.businessId],
    references: [businesses.id],
  }),
  bookings: many(bookings),
  staffLinks: many(staffServices, { relationName: 'StaffToServices' }),
  staff: many(staff, { relationName: 'StaffToServices' }),
}));

// -------- Staff --------
export const staffRelations = relations(staff, ({ one, many }) => ({
  business: one(businesses, {
    fields: [staff.businessId],
    references: [businesses.id],
  }),
  bookings: many(bookings),

  availability: many(staffAvailability),
  timeOff: many(staffTimeOff),

  serviceLinks: many(staffServices, { relationName: 'StaffToServices' }),
  services: many(services, { relationName: 'StaffToServices' }),
}));

export const staffAvailabilityRelations = relations(
  staffAvailability,
  ({ one }) => ({
    staff: one(staff, {
      fields: [staffAvailability.staffId],
      references: [staff.id],
    }),
  }),
);

export const staffTimeOffRelations = relations(staffTimeOff, ({ one }) => ({
  staff: one(staff, {
    fields: [staffTimeOff.staffId],
    references: [staff.id],
  }),
}));

export const staffServiceRelations = relations(staffServices, ({ one }) => ({
  staff: one(staff, {
    fields: [staffServices.staffId],
    references: [staff.id],
    relationName: 'StaffToServices',
  }),
  service: one(services, {
    fields: [staffServices.serviceId],
    references: [services.id],
    relationName: 'StaffToServices',
  }),
}));

// -------- Customers --------
export const customerRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [customers.businessId],
    references: [businesses.id],
  }),
  bookings: many(bookings),
}));

// -------- Bookings --------
export const bookingRelations = relations(bookings, ({ one, many }) => ({
  business: one(businesses, {
    fields: [bookings.businessId],
    references: [businesses.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  staff: one(staff, {
    fields: [bookings.staffId],
    references: [staff.id],
  }),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  statusHistory: many(bookingStatusHistory),
}));

export const bookingStatusHistoryRelations = relations(
  bookingStatusHistory,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingStatusHistory.bookingId],
      references: [bookings.id],
    }),
    changedBy: one(users, {
      fields: [bookingStatusHistory.changedByUserId],
      references: [users.id],
      relationName: 'BookingStatusChangedByUser',
    }),
  }),
);

// -------- Sessions / Tokens --------
export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const tokenRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [verificationTokens.userId],
    references: [users.id],
  }),
}));
