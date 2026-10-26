import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { CasesModule } from '../cases/cases.module';
import { AdoptionsModule } from '../adoptions/adoptions.module';
import { ServicesModule } from '../services/services.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminPendingEditsController } from './admin-edits.controller';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    // The second-review queue reads the three kinds of rows, each in the module
    // that owns it — the admin module never grows a second copy of a `WHERE`.
    CasesModule,
    AdoptionsModule,
    ServicesModule,
  ],
  controllers: [AdminController, AdminPendingEditsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
