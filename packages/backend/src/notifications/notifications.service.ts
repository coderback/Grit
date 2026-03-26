import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async registerToken(supabaseId: string, token: string, _platform: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { supabaseId },
      data: { pushToken: token },
    });

    return { ok: true };
  }
}
