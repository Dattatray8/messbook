import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './common/guards/auth.guard';
import { HealthModule } from './health/health.module';
import { MessModule } from './mess/mess.module';
import { CustomersModule } from './customers/customers.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { MealRecordsModule } from './meal-records/meal-records.module';
import { BillsModule } from './bills/bills.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI')!,
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    AuthModule,
    MessModule,
    CustomersModule,
    MenuItemsModule,
    MealRecordsModule,
    BillsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
