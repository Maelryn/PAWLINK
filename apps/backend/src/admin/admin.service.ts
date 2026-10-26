import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import { userRowToUser } from '../users/serialize';
import { UsersService } from '../users/users.service';
import type { User } from '../shared/types';
import type { Paginated } from '../shared/pagination';
import type { QueryUsersDto } from './dto/query-users.dto';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { AdminStatsDto } from './dto/admin-stats.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async stats(): Promise<AdminStatsDto> {
    const [
      usersTotal,
      usersByRoleRows,
      casesTotal,
      casesByStatusRows,
      casesPending,
      adoptionsTotal,
      adoptionsByStatusRows,
      servicesTotal,
      servicesByStatusRows,
      reviewsTotal,
      bookingsTotal,
      bookingsByStatusRows,
      notificationsTotal,
      notificationsUnread,
      zonesTotal,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.case.count(),
      this.prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.case.count({ where: { moderation: 'pending' } }),
      this.prisma.adoption.count(),
      this.prisma.adoption.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.service.count(),
      this.prisma.service.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.review.count(),
      this.prisma.booking.count(),
      this.prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { read: false } }),
      this.prisma.emergencyZone.count(),
    ]);

    const toMap = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string) => {
      const out: Record<string, number> = {};
      for (const r of rows) out[String(r[key])] = r._count._all;
      return out;
    };

    return {
      users: usersTotal,
      usersByRole: toMap(usersByRoleRows as never, 'role'),
      cases: casesTotal,
      casesByStatus: toMap(casesByStatusRows as never, 'status'),
      casesPendingModeration: casesPending,
      adoptions: adoptionsTotal,
      adoptionsByStatus: toMap(adoptionsByStatusRows as never, 'status'),
      services: servicesTotal,
      servicesByStatus: toMap(servicesByStatusRows as never, 'status'),
      reviews: reviewsTotal,
      bookings: bookingsTotal,
      bookingsByStatus: toMap(bookingsByStatusRows as never, 'status'),
      notifications: notificationsTotal,
      notificationsUnread: notificationsUnread,
      zones: zonesTotal,
    };
  }

  async listUsers(query: QueryUsersDto): Promise<Paginated<User>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role as never;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map(userRowToUser),
      total,
      page,
      pageSize,
    };
  }

  async updateRole(id: string, dto: UpdateUserRoleDto): Promise<User> {
    const row = await this.users.findById(id);
    if (!row || !row.passwordHash) {
      throw new ApiError(404, 'NOT_FOUND', 'Cet utilisateur n’existe pas.');
    }
    const data: Prisma.UserUncheckedUpdateInput = { role: dto.role as never };
    if (dto.licenseVerified !== undefined) data.licenseVerified = dto.licenseVerified;
    // A vet role implies a verified license; keep the two in sync when promoting.
    if (dto.role === 'vet' && dto.licenseVerified === undefined) {
      data.licenseVerified = true;
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    return userRowToUser(updated);
  }
}
