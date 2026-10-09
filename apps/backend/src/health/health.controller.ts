import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/auth.decorators';
import { PrismaService } from '../common/prisma/prisma.service';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe + database reachability' })
  @ApiOkResponse({
    description: 'Always answers (even with the DB down) so monitors and humans see the real state.',
    schema: {
      example: {
        status: 'ok',
        db: 'up',
        uptimeSec: 12,
        timestamp: '2026-10-03T10:00:00.000Z',
        version: '0.1.0',
      },
    },
  })
  async health() {
    let db: 'up' | 'down' = 'down';
    try {
      await withTimeout(this.prisma.ping(), 2500);
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }
}
