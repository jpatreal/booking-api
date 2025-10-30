import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { makeDb } from './index';

export const DRIZZLE = Symbol('DRIZZLE_DB');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL missing');
        return makeDb(url).db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
