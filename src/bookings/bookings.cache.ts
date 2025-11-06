import { Injectable, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BookingKeys } from '@app/cache/redis-keys';

@Injectable()
export class BookingsCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async getAvailability(
    businessId: string,
    staffId: string,
    isoDateLocal: string,
  ) {
    return this.cache.get(
      BookingKeys.availability(businessId, staffId, isoDateLocal),
    );
  }

  async setAvailability(
    businessId: string,
    staffId: string,
    isoDateLocal: string,
    value: any,
    ttlSec = 60,
  ) {
    await this.cache.set(
      BookingKeys.availability(businessId, staffId, isoDateLocal),
      value,
      ttlSec,
    );
  }

  async bustAvailability(
    businessId: string,
    staffId: string,
    isoDateLocal: string,
  ) {
    await this.cache.del(
      BookingKeys.availability(businessId, staffId, isoDateLocal),
    );
  }

  async getFreeSlots(
    businessId: string,
    serviceId: string,
    staffId: string,
    isoDateLocal: string,
  ) {
    return this.cache.get(
      BookingKeys.freeSlots(businessId, serviceId, staffId, isoDateLocal),
    );
  }

  async setFreeSlots(
    businessId: string,
    serviceId: string,
    staffId: string,
    isoDateLocal: string,
    value: any,
    ttlSec = 60,
  ) {
    await this.cache.set(
      BookingKeys.freeSlots(businessId, serviceId, staffId, isoDateLocal),
      value,
      ttlSec,
    );
  }

  async bustFreeSlots(
    businessId: string,
    serviceId: string,
    staffId: string,
    isoDateLocal: string,
  ) {
    await this.cache.del(
      BookingKeys.freeSlots(businessId, serviceId, staffId, isoDateLocal),
    );
  }
}
