import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Internal-only module. No controllers — other auth-service modules
 * (auth, two-factor, invites, etc.) consume UsersService via DI.
 */
@Module({
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
