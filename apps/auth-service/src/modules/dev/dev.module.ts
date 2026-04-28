import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Registered in AppModule only when NODE_ENV !== 'production'.
 * Exposes dev shortcuts (e.g. bypass email verification).
 */
@Module({
  imports: [AuthModule],
  controllers: [DevController],
})
export class DevModule {}
