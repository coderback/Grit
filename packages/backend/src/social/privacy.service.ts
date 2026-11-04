import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FollowState = 'none' | 'pending' | 'accepted';

export interface Relationship {
  /** The viewer's follow of the other user */
  following: FollowState;
  /** The other user's follow of the viewer */
  followsYou: FollowState;
  /** The viewer has blocked the other user */
  blocked: boolean;
}

/**
 * Who may see whom. Accounts are private by default: only approved followers
 * see a private account's activity. A block in either direction hides the two
 * users from each other entirely.
 */
@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService) {}

  /** True if either user has blocked the other. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return !!block;
  }

  /** IDs of everyone the user has blocked or been blocked by. */
  async blockedIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map((b) =>
      b.blockerId === userId ? b.blockedId : b.blockerId,
    );
  }

  /** The viewer's relationship with each of `otherIds`, in one round trip. */
  async relationships(
    viewerId: string,
    otherIds: string[],
  ): Promise<Map<string, Relationship>> {
    const [follows, blocks] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          OR: [
            { followerId: viewerId, followingId: { in: otherIds } },
            { followingId: viewerId, followerId: { in: otherIds } },
          ],
        },
        select: { followerId: true, followingId: true, status: true },
      }),
      this.prisma.block.findMany({
        where: { blockerId: viewerId, blockedId: { in: otherIds } },
        select: { blockedId: true },
      }),
    ]);

    const result = new Map<string, Relationship>();
    for (const id of otherIds) {
      result.set(id, { following: 'none', followsYou: 'none', blocked: false });
    }
    for (const f of follows) {
      const status = f.status as FollowState;
      if (f.followerId === viewerId) {
        const r = result.get(f.followingId);
        if (r) r.following = status;
      } else {
        const r = result.get(f.followerId);
        if (r) r.followsYou = status;
      }
    }
    for (const b of blocks) {
      const r = result.get(b.blockedId);
      if (r) r.blocked = true;
    }
    return result;
  }

  async relationship(viewerId: string, otherId: string): Promise<Relationship> {
    const map = await this.relationships(viewerId, [otherId]);
    return map.get(otherId)!;
  }

  /**
   * Whether the viewer may see the owner's activity: their own, a public
   * account's, or a private account's they're an approved follower of.
   */
  async canView(viewerId: string, ownerId: string): Promise<boolean> {
    if (viewerId === ownerId) return true;
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { isPrivate: true },
    });
    if (!owner) return false;
    if (await this.isBlockedEitherWay(viewerId, ownerId)) return false;
    if (!owner.isPrivate) return true;
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: ownerId },
      },
      select: { status: true },
    });
    return follow?.status === 'accepted';
  }
}
