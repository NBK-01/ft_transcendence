import * as argon2 from 'argon2';
import dataSource from '../data-source';
import { Role } from '../../access-control/entities/role.entity';
import { InternalUser } from '../../internal-users/internal-user.entity';

/**
 * The one secret-bearing bootstrap step (roles/permissions/matrix are
 * non-secret fixture data, seeded directly in the migration instead — see
 * RbacInternalUsersOrganizations). Creates the first admin InternalUser so
 * the admin-only /internal-users endpoint has someone able to call it.
 * Idempotent — safe to re-run in any environment/CI.
 */
async function bootstrap(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set',
    );
  }

  await dataSource.initialize();

  try {
    const internalUserRepo = dataSource.getRepository(InternalUser);
    const roleRepo = dataSource.getRepository(Role);

    const existing = await internalUserRepo.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      console.log(`Bootstrap admin ${email} already exists — nothing to do.`);
      return;
    }

    const adminRole = await roleRepo.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      throw new Error(
        "'admin' role not found — run migrations first (npm run migration:run)",
      );
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const user = internalUserRepo.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: 'Bootstrap Admin',
      roleId: adminRole.id,
      isActive: true,
    });
    await internalUserRepo.save(user);

    console.log(`Bootstrap admin created: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
