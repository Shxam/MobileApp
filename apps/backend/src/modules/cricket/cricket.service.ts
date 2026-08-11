import { Injectable, Logger, Inject } from '@nestjs/common';
import { env } from '../../common/config/env';
import { RedisService } from '../../common/redis/redis.service';

export interface LiveMatchItem {
  id: string;
  type: 'score' | 'news';
  matchTitle: string;
  series: string;
  team1: { name: string; code: string; score: string; overs: string; flagBg: string };
  team2: { name: string; code: string; score: string; overs: string; flagBg: string };
  statusText: string;
  isLive: boolean;
  scorecardDetails?: {
    team1Batter: string;
    team1Bowler: string;
    target?: string;
    crr: string;
    rrr?: string;
  };
}

/** Shape of the subset of the CricAPI `currentMatches` response we consume. */
interface CricApiInnings {
  r?: number;
  w?: number;
  o?: number;
  inning?: string;
}

interface CricApiMatch {
  id?: string;
  name?: string;
  matchType?: string;
  status?: string;
  matchStarted?: boolean;
  matchEnded?: boolean;
  teams?: string[];
  teamInfo?: Array<{ name?: string; shortname?: string }>;
  score?: CricApiInnings[];
}

interface CricApiResponse {
  data?: CricApiMatch[];
}

const ENDED_STATUS = /won|win by|awarded|abandoned|tied|drawn|no result|completed/i;

@Injectable()
export class CricketService {
  private readonly logger = new Logger(CricketService.name);
  private readonly CACHE_KEY = 'cricket:live_scores';
  private readonly CACHE_TTL_SECONDS = 15;

  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  /**
   * Live scores from CricAPI, cached briefly in Redis.
   *
   * Returns an empty list when the upstream is unavailable or the key is not
   * configured. It deliberately does NOT synthesise placeholder matches — a
   * fabricated scoreboard is indistinguishable from a real one to the user.
   */
  async getLiveScores(): Promise<LiveMatchItem[]> {
    try {
      const cached = await this.redisService.get(this.CACHE_KEY);
      if (cached) return JSON.parse(cached) as LiveMatchItem[];
    } catch {
      // A cache miss or outage is not fatal — fall through to the upstream.
    }

    const apiKey = env.cricketApiKey;
    if (!apiKey) {
      this.logger.warn('CRICKET_API_KEY is not configured — live scores unavailable.');
      return [];
    }

    let matches: LiveMatchItem[] = [];
    try {
      const response = await fetch(
        `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(apiKey)}&offset=0`,
      );
      if (!response.ok) {
        this.logger.warn(`CricAPI responded ${response.status} — live scores unavailable.`);
        return [];
      }

      const result = (await response.json()) as CricApiResponse;
      const all = Array.isArray(result.data) ? result.data : [];

      const live = all.filter((m) => m.matchStarted && !m.matchEnded && !ENDED_STATUS.test(m.status ?? ''));
      const candidates = live.length > 0 ? live : all.filter((m) => !m.matchEnded);

      matches = candidates.slice(0, 5).map((m, idx) => this.toLiveMatchItem(m, idx));
      this.logger.log(`Fetched ${matches.length} active matches from CricAPI.`);
    } catch (err) {
      this.logger.warn(`CricAPI fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }

    try {
      await this.redisService.set(this.CACHE_KEY, JSON.stringify(matches), this.CACHE_TTL_SECONDS);
    } catch {
      // Caching is best-effort.
    }

    return matches;
  }

  private toLiveMatchItem(m: CricApiMatch, idx: number): LiveMatchItem {
    const t1 = m.teamInfo?.[0];
    const t2 = m.teamInfo?.[1];
    const name1 = t1?.name ?? m.teams?.[0] ?? 'Team 1';
    const name2 = t2?.name ?? m.teams?.[1] ?? 'Team 2';

    const inningsFor = (teamName: string, fallbackIndex: number): CricApiInnings | undefined =>
      m.score?.find((s) => s.inning?.toLowerCase().includes(teamName.toLowerCase())) ?? m.score?.[fallbackIndex];

    const s1 = inningsFor(name1, 0);
    const s2 = inningsFor(name2, 1);

    const fmtScore = (s?: CricApiInnings) => (s ? `${s.r ?? 0}/${s.w ?? 0}` : '0/0');
    const fmtOvers = (s?: CricApiInnings) => `${s?.o ?? 0} Overs`;
    const code = (info: { shortname?: string } | undefined, full: string, len: number) =>
      info?.shortname ?? full.substring(0, len).toUpperCase();

    return {
      id: m.id ?? `live_${idx}`,
      type: 'score',
      matchTitle: `${code(t1, name1, 4)} VS ${code(t2, name2, 4)} • ${m.matchType?.toUpperCase() ?? 'LIVE MATCH'}`,
      series: m.name ?? 'Live Cricket',
      team1: {
        name: name1,
        code: code(t1, name1, 3),
        score: fmtScore(s1),
        overs: fmtOvers(s1),
        flagBg: idx % 2 === 0 ? 'bg-blue-600' : 'bg-rose-600',
      },
      team2: {
        name: name2,
        code: code(t2, name2, 3),
        score: fmtScore(s2),
        overs: fmtOvers(s2),
        flagBg: idx % 2 === 0 ? 'bg-amber-500' : 'bg-emerald-600',
      },
      statusText: m.status ?? 'Match in progress',
      isLive: Boolean(m.matchStarted && !m.matchEnded),
    };
  }
}
