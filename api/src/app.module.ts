import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CarrosModule } from './carros/carros.module';
import { CitacionesModule } from './citaciones/citaciones.module';
import { CuartelerosModule } from './cuarteleros/cuarteleros.module';
import { GuardiaModule } from './guardia/guardia.module';
import { LicenciasModule } from './licencias/licencias.module';
import { OficialidadModule } from './oficialidad/oficialidad.module';
import { PermisosModule } from './permisos/permisos.module';
import { PrismaModule } from './prisma/prisma.module';
import { TurnosModule } from './turnos/turnos.module';
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
    TurnosModule,
    CitacionesModule,
    PermisosModule,
    GuardiaModule,
    LicenciasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
