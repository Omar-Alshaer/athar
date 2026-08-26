import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from '../src/generated/prisma/client';
import { PasswordService } from '../src/auth/password.service';

loadEnv({ path: '../../.env' });

const connectionString = process.env.DATABASE_URL;
const email = process.env.ATHR_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ATHR_ADMIN_PASSWORD ?? '';
const fullName = process.env.ATHR_ADMIN_NAME?.trim() || 'مدير أثر';

if (!connectionString) throw new Error('DATABASE_URL is required.');
if (!email) throw new Error('ATHR_ADMIN_EMAIL is required.');
if (password.length < 12) {
  throw new Error('ATHR_ADMIN_PASSWORD must be at least 12 characters.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const passwords = new PasswordService();

async function main(): Promise<void> {
  const passwordHash = await passwords.hash(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      fullName,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: { id: true, email: true, fullName: true, role: true, status: true },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorUserId: user.id,
      action: 'SUPER_ADMIN_BOOTSTRAP',
      entityType: 'User',
      entityId: user.id,
    },
  });

  console.log('ATHR super admin is ready:');
  console.log(`${user.fullName} <${user.email}> [${user.role}]`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
