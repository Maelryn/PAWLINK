import { ApiProperty } from '@nestjs/swagger';

export class AdminStatsDto {
  @ApiProperty() users!: number;
  @ApiProperty() usersByRole!: Record<string, number>;
  @ApiProperty() cases!: number;
  @ApiProperty() casesByStatus!: Record<string, number>;
  @ApiProperty() casesPendingModeration!: number;
  @ApiProperty() adoptions!: number;
  @ApiProperty() adoptionsByStatus!: Record<string, number>;
  @ApiProperty() services!: number;
  @ApiProperty() servicesByStatus!: Record<string, number>;
  @ApiProperty() reviews!: number;
  @ApiProperty() bookings!: number;
  @ApiProperty() bookingsByStatus!: Record<string, number>;
  @ApiProperty() notifications!: number;
  @ApiProperty() notificationsUnread!: number;
  @ApiProperty() zones!: number;
}