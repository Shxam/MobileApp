import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Turf } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';

/**
 * A turf as the customer app consumes it. Mirrors `packages/types` `Turf`:
 * money is paise and the two nullable lat/lng columns are folded into the
 * `coordinates` pair the map component expects.
 */
export interface TurfData {
  id: string;
  name: string;
  location: string;
  area: string;
  rating: number;
  reviewsCount: number;
  pricePerHourPaise: number;
  image: string;
  gallery: string[];
  amenities: string[];
  pitchType: string;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  description: string;
  dhabaId: string;
}

@Injectable()
export class TurfsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The turf list behind the browse screen.
   *
   * `search` matches the same three fields the customer app used to filter its
   * mock array on — name, location and area — so the search box behaves the
   * same way now that the rows come from the database.
   */
  async list(search?: string): Promise<TurfData[]> {
    const term = search?.trim();
    const contains = (field: 'name' | 'location' | 'area'): Prisma.TurfWhereInput => ({
      [field]: { contains: term, mode: 'insensitive' as const },
    });

    const turfs = await this.prisma.turf.findMany({
      where: {
        dhabaId: env.defaultDhabaId,
        isActive: true,
        ...(term ? { OR: [contains('name'), contains('location'), contains('area')] } : {}),
      },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    });
    return turfs.map((turf) => this.serialize(turf));
  }

  async getById(id: string): Promise<TurfData> {
    const turf = await this.prisma.turf.findUnique({ where: { id } });
    // An inactive turf is treated as absent rather than hidden-but-readable:
    // a stale deep link should not resurrect a pitch that is no longer sold.
    if (!turf || !turf.isActive) throw new NotFoundException('Turf not found.');
    return this.serialize(turf);
  }

  private serialize(turf: Turf): TurfData {
    return {
      id: turf.id,
      name: turf.name,
      location: turf.location,
      area: turf.area,
      rating: turf.rating,
      reviewsCount: turf.reviewsCount,
      pricePerHourPaise: turf.pricePerHourPaise,
      image: turf.image,
      gallery: turf.gallery,
      amenities: turf.amenities,
      pitchType: turf.pitchType,
      address: turf.address,
      // Null rather than a fabricated (0, 0) — the map should decline to place
      // a pin it does not have, not drop one in the Gulf of Guinea.
      coordinates:
        turf.latitude !== null && turf.longitude !== null
          ? { lat: turf.latitude, lng: turf.longitude }
          : null,
      description: turf.description,
      dhabaId: turf.dhabaId,
    };
  }
}
