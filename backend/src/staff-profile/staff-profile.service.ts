import { Injectable } from '@nestjs/common';
import { AccessControlService } from '../access-control/access-control.service';
import { PresenceService } from '../chat/presence.service';
import { AccountType } from '../common/context/auth-context.types';
import { ContactsService } from '../contacts/contacts.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUserNotFoundException } from '../internal-users/exceptions';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { StaffMeDto } from '../staff-auth/dto/staff-me.dto';
import { StaffProfileDto } from './dto/staff-profile.dto';

/**
 * A staff member's own profile (their name and photo) and their colleagues'
 * profile pages. Email, role and branch stay an admin's to change
 * (InternalUsersService.update).
 */
@Injectable()
export class StaffProfileService {
  constructor(
    private readonly internalUsersService: InternalUsersService,
    private readonly accessControlService: AccessControlService,
    private readonly fileStorageService: FileStorageService,
    private readonly contactsService: ContactsService,
    private readonly presenceService: PresenceService,
  ) {}

  /** The signed-in staff member as they are now: a rename, a new role or branch shows without signing in again. */
  async me(id: string): Promise<StaffMeDto> {
    const [staff, permissions] = await Promise.all([
      this.findWithBranch(id),
      this.accessControlService.getEffectivePermissions(id),
    ]);
    const { organization } = staff;
    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      roleName: staff.role?.name ?? null,
      organizationId: staff.organizationId,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            isActive: organization.isActive,
          }
        : null,
      avatarUrl: await this.avatarUrl(staff),
      permissions,
    };
  }

  async rename(id: string, name: string): Promise<StaffMeDto> {
    await this.internalUsersService.renameSelf(id, name);
    return this.me(id);
  }

  /** Same rules as a customer's avatar (FileStorageService: JPEG/PNG/WebP, 2 MB); the old photo is deleted. */
  async uploadAvatar(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    const { url, key } = await this.fileStorageService.uploadAvatar(
      file.buffer,
      id,
      file.originalname,
      file.mimetype,
    );
    const { previousKey } = await this.internalUsersService.setAvatar(id, key);
    await this.deleteQuietly(previousKey);
    return { avatarUrl: url };
  }

  /** Back to their initials. Nothing to remove is fine too. */
  async removeAvatar(id: string): Promise<{ avatarUrl: null }> {
    const { previousKey } = await this.internalUsersService.setAvatar(id, null);
    await this.deleteQuietly(previousKey);
    return { avatarUrl: null };
  }

  /**
   * A colleague's profile page: what any staff member may see of another.
   * Whether they're online only shows to their accepted contacts, like on
   * the contacts list.
   */
  async profileOf(viewerId: string, id: string): Promise<StaffProfileDto> {
    const staff = await this.findWithBranch(id);
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      roleName: staff.role?.name ?? null,
      organization: staff.organization
        ? { id: staff.organization.id, name: staff.organization.name }
        : null,
      avatarUrl: await this.avatarUrl(staff),
      isActive: staff.isActive,
      online: await this.onlineFor(viewerId, staff.id),
      createdAt: staff.createdAt,
    };
  }

  private async onlineFor(
    viewerId: string,
    id: string,
  ): Promise<boolean | null> {
    if (viewerId === id) {
      return true;
    }
    if (!(await this.contactsService.areConnected(viewerId, id))) {
      return null;
    }
    return this.presenceService.isOnline(AccountType.STAFF, id);
  }

  private async findWithBranch(id: string): Promise<InternalUser> {
    const staff = await this.internalUsersService.findWithBranch(id);
    if (!staff) {
      throw new InternalUserNotFoundException(id);
    }
    return staff;
  }

  private avatarUrl(staff: InternalUser): Promise<string | null> {
    return staff.avatarKey
      ? this.fileStorageService.getAvatarUrl(staff.avatarKey)
      : Promise.resolve(null);
  }

  /** The old photo: the new one is saved already, so a failed clean-up only leaves an orphaned file. */
  private async deleteQuietly(key: string | null): Promise<void> {
    if (!key) {
      return;
    }
    await this.fileStorageService.deleteFile(key).catch(() => undefined);
  }
}
