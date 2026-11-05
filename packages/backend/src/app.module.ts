import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { WorkoutPlanModule } from './workout-plan/workout-plan.module';
import { AlertsModule } from './alerts/alerts.module';
import { ProgressModule } from './progress/progress.module';
import { AppController } from './app.controller';
import { validateEnv } from './config/env';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { requestContext } from './observability/request-context';
import { UserThrottlerGuard } from './observability/throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Requests a minute per signed-in session (or per IP when signed out):
    // well above what a person tapping around the app sends
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
      },
    ]),
    ScheduleModule.forRoot(),
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
    WorkoutPlanModule,
    AlertsModule,
    ProgressModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestContext).forRoutes('*');
  }
}
