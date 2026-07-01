import { PrismaClient, RolSistema, TipoVoluntario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existente = await prisma.user.findUnique({ where: { username: '1' } });
  if (existente) {
    console.log('Usuario de prueba ya existe (username: 1)');
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.create({
    data: {
      username: '1',
      passwordHash,
      voluntario: {
        create: {
          correlativo: 1,
          tipo: TipoVoluntario.QUINCE,
          nombres: 'Admin',
          apellidoP: 'Sistema',
          rut: '11111111',
          rutDigito: '1',
          company: 15,
          email: 'admin@guardianes.local',
          roles: {
            create: [{ rol: RolSistema.ADMIN }],
          },
        },
      },
    },
  });

  console.log('Usuario de prueba creado -> username: 1 / password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
