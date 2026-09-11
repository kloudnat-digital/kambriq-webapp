import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { CorePrismaService } from './prisma/core-prisma.service';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { RolesService } from './roles/roles.service';
import { AuthController } from './auth/auth.controller';
import { UserController } from './users/users.controller';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { CoreCleanupProcessor } from './cleanup/cleanup.processor';
import { CleanupScheduler } from './cleanup/cleanup.scheduler';
import { ContactController } from './contact/contact.controller';
import { ContactService } from './contact/contact.service';
import { StorageService } from '@kambriq/common';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<StringValue>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UserController, ContactController],
  providers: [
    CorePrismaService,
    AuthService,
    JwtStrategy,
    UsersService,
    RolesService,
    CoreCleanupProcessor,
    CleanupScheduler,
    StorageService,
    ContactService,
  ],
  // Export services needed by other modules (e.g., KbsModule)
  exports: [UsersService, RolesService, CorePrismaService, ContactService],
})
export class CoreModule {}
