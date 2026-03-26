import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FoodModule } from './food/food.module';
import { ActivityModule } from './activity/activity.module';
import { HabitsModule } from './habits/habits.module';
import { SocialModule } from './social/social.module';
import { ChallengesModule } from './challenges/challenges.module';
import { AIModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FoodModule,
    ActivityModule,
    HabitsModule,
    SocialModule,
    ChallengesModule,
    AIModule,
    NotificationsModule,
  ],
})
export class AppModule {}
