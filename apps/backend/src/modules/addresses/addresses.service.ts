import { Injectable, NotFoundException } from '@nestjs/common';
import type { Address, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * A customer keeping hundreds of addresses is a runaway client, not a user with
 * a lot of homes. The cap is enforced by pruning the oldest non-default row so a
 * save never fails with a wall the customer cannot clear.
 */
const MAX_ADDRESSES_PER_USER = 20;

export interface AddressView {
  id: string;
  label: string;
  detail: string;
  landmark: string | null;
  pincode: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface AddressInput {
  label: string;
  detail: string;
  landmark?: string;
  pincode?: string;
  isDefault?: boolean;
}

/**
 * Saved delivery addresses.
 *
 * Every read and write is scoped by `userId` inside the `where` clause rather
 * than fetched and then compared, so there is no window in which one customer's
 * query can touch another's row.
 */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * The first address a customer saves becomes their default automatically —
   * otherwise checkout has a list with nothing preselected.
   */
  async create(userId: string, input: AddressInput): Promise<AddressView> {
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.count({ where: { userId } });
      const isDefault = input.isDefault === true || existing === 0;

      if (isDefault) await this.clearDefault(tx, userId);
      if (existing >= MAX_ADDRESSES_PER_USER) await this.pruneOldest(tx, userId);

      return tx.address.create({
        data: {
          userId,
          label: input.label,
          detail: input.detail,
          landmark: input.landmark ?? null,
          pincode: input.pincode ?? null,
          isDefault,
        },
      });
    });

    return this.toView(created);
  }

  async update(userId: string, id: string, input: Partial<AddressInput>): Promise<AddressView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Ownership lives in the `where`, so a mismatched id is indistinguishable
      // from a missing one — a probe learns nothing about other users' rows.
      const owned = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) throw new NotFoundException('Address not found');

      if (input.isDefault === true) await this.clearDefault(tx, userId);

      const data: Prisma.AddressUpdateInput = {};
      if (input.label !== undefined) data.label = input.label;
      if (input.detail !== undefined) data.detail = input.detail;
      if (input.landmark !== undefined) data.landmark = input.landmark;
      if (input.pincode !== undefined) data.pincode = input.pincode;
      if (input.isDefault !== undefined) data.isDefault = input.isDefault;

      return tx.address.update({ where: { id }, data });
    });

    return this.toView(updated);
  }

  /**
   * Deleting the default promotes the next-newest address, so a customer is
   * never left with a list where nothing is selected at checkout.
   */
  async remove(userId: string, id: string): Promise<{ success: true; promotedId: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.address.deleteMany({ where: { id, userId } });
      if (count === 0) throw new NotFoundException('Address not found');

      const remainingDefault = await tx.address.findFirst({
        where: { userId, isDefault: true },
        select: { id: true },
      });
      if (remainingDefault) return { success: true as const, promotedId: null };

      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!next) return { success: true as const, promotedId: null };

      await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      return { success: true as const, promotedId: next.id };
    });
  }

  private clearDefault(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.BatchPayload> {
    return tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  private async pruneOldest(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const oldest = await tx.address.findFirst({
      where: { userId, isDefault: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (oldest) await tx.address.delete({ where: { id: oldest.id } });
  }

  private toView(row: Address): AddressView {
    return {
      id: row.id,
      label: row.label,
      detail: row.detail,
      landmark: row.landmark,
      pincode: row.pincode,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
