import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  description:
    'Aggregate platform statistics. Every `*ByStatus` / `usersByRole` map is keyed by the ' +
    'enum value, and only the keys that exist in the database are present.',
})
export class AdminStatsDto {
  @ApiProperty({ example: 128, description: 'Total accounts, every role included.' })
  users!: number;

  @ApiProperty({
    description: 'Accounts per role.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { reporter: 70, volunteer: 45, vet: 10, admin: 3 },
  })
  usersByRole!: Record<string, number>;

  @ApiProperty({ example: 212, description: 'Total cases, every moderation state included.' })
  cases!: number;

  @ApiProperty({
    description: 'Cases per lifecycle status.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { open: 90, in_progress: 40, resolved: 82 },
  })
  casesByStatus!: Record<string, number>;

  @ApiProperty({
    example: 7,
    description: 'Cases held for moderation and therefore off the public map.',
  })
  casesPendingModeration!: number;

  @ApiProperty({ example: 34, description: 'Total adoption listings.' })
  adoptions!: number;

  @ApiProperty({
    description: 'Adoption listings per moderation status.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { pending: 4, approved: 28, rejected: 2 },
  })
  adoptionsByStatus!: Record<string, number>;

  @ApiProperty({ example: 51, description: 'Total service listings.' })
  services!: number;

  @ApiProperty({
    description: 'Service listings per moderation status.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { pending: 3, approved: 45, rejected: 3 },
  })
  servicesByStatus!: Record<string, number>;

  @ApiProperty({ example: 120, description: 'Total reviews written.' })
  reviews!: number;

  @ApiProperty({ example: 19, description: 'Total appointment bookings.' })
  bookings!: number;

  @ApiProperty({
    description: 'Bookings per status.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { sent: 5, confirmed: 11, declined: 3 },
  })
  bookingsByStatus!: Record<string, number>;

  @ApiProperty({ example: 340, description: 'Total notifications written.' })
  notifications!: number;

  @ApiProperty({ example: 12, description: 'Notifications the recipient has not read yet.' })
  notificationsUnread!: number;

  @ApiProperty({ example: 2, description: 'Total emergency zones.' })
  zones!: number;
}
