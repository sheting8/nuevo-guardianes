import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CarrosModule } from './carros/carros.module';
import { CuartelerosModule } from './cuarteleros/cuarteleros.module';
import { OficialidadModule } from './oficialidad/oficialidad.module';
import { PrismaModule } from './prisma/prisma.module';
import { VoluntariosModule } from './voluntarios/voluntarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    VoluntariosModule,
    OficialidadModule,
    CuartelerosModule,
    CarrosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
