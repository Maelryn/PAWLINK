import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { prismaClientOptions } from '../src/common/prisma/client-options';

/**
 * Creates (or promotes) an administrator. Admin is NEVER a sign-up option (§3.2) —
 * this CLI and the seed are the only ways one comes to exist.
 *
 *   npm run seed:admin -- --email ines@pawlink.dz --password <secret> [--name "Ines Khelifi"] [--phone "+213..."]
 */

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = argValue('email');
  const password = argValue('password');
  const name = argValue('name') ?? 'Administrator';
  const phone = argValue('phone');

  if (!email || !password) {
    console.error(
      'Usage: npm run seed:admin -- --email you@pawlink.dz --password <secret> [--name "Full Name"] [--phone "+213..."]',
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient(prismaClientOptions());
  try {
    const passwordHash = await hash(password);
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase().trim() },
      update: { role: 'admin', phoneVerified: true, passwordHash },
      create: {
        email: email.toLowerCase().trim(),
        name,
        phone,
        role: 'admin',
        phoneVerified: true,
        avatar: '',
        passwordHash,
      },
    });
    // The password itself is never echoed back.
    console.log(`Admin ready: ${user.email} (${user.id}) role=admin`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('seed:admin failed:', err);
  process.exitCode = 1;
});
