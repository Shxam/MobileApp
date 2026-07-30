import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, RefreshCw, ChevronLeft, ChevronRight, Trophy, Zap, X, Activity } from 'lucide-react';

interface ScoreCardItem {
  id: string;
  matchTitle: string;
  series: string;
  team1: { name: string; code: string; score: string; overs: string; flagBg: string };
  team2: { name: string; code: string; score: string; overs: string; flagBg: string };
  statusText: string;
  isLive: boolean;
  type: 'score' | 'news';
  newsTitle?: string;
  newsSummary?: string;
  scorecardDetails?: {
    team1Batter: string;
    team1Bowler: string;
    target?: string;
    crr: string;
    rrr?: string;
  };
}

const MOCK_CRICKET_DATA: ScoreCardItem[] = [
  {
    id: 'm1',
    type: 'score',
    matchTitle: 'ROYAL CHALLENGERS BENGALURU VS CHENNAI SUPER KINGS',
    series: 'IPL 2026 SEASON OPENER • M CHINNASWAMY STADIUM',
    team1: { name: 'Bengaluru', code: 'RCB', score: '184/4', overs: '18.2 Overs', flagBg: 'bg-red-600' },
    team2: { name: 'Chennai', code: 'CSK', score: '178/6', overs: '20.0 Overs', flagBg: 'bg-amber-500' },
    statusText: '⚡ RCB need 7 runs in 10 balls to win',
    isLive: true,
    scorecardDetails: {
      team1Batter: 'V. Kohli 78* (44) • R. Patidar 42 (21)',
      team1Bowler: 'R. Jadeja 2/32 (4.0)',
      target: 'Target: 179',
      crr: 'CRR: 10.03',
      rrr: 'RRR: 4.20',
    },
  },
  {
    id: 'm2',
    type: 'score',
    matchTitle: 'INDIA VS AUSTRALIA, 3RD T20I',
    series: 'AUSTRALIA TOUR OF INDIA 2026',
    team1: { name: 'India', code: 'IND', score: '208/5', overs: '20.0 Overs', flagBg: 'bg-blue-600' },
    team2: { name: 'Australia', code: 'AUS', score: '195/8', overs: '19.4 Overs', flagBg: 'bg-yellow-500' },
    statusText: '⚡ IND lead series 2-1 • 14 runs needed off 2 balls',
    isLive: true,
    scorecardDetails: {
      team1Batter: 'S. Yadav 64 (28) • H. Pandya 34* (14)',
      team1Bowler: 'J. Bumrah 3/24 (4.0)',
      target: 'Target: 209',
      crr: 'CRR: 10.40',
      rrr: 'RRR: 42.0',
    },
  },
  {
    id: 'm3',
    type: 'news',
    matchTitle: 'SINGARAYAKONDA BOX TURF LEAGUE 2026',
    series: 'IPL DHABA ARENA SPECIAL BASH',
    team1: { name: 'Dhaba Strikers', code: 'STR', score: '112/3', overs: '10.0 Overs', flagBg: 'bg-orange-600' },
    team2: { name: 'Turf Kings', code: 'TKG', score: '108/6', overs: '10.0 Overs', flagBg: 'bg-emerald-600' },
    statusText: '🏆 Strikers win by 4 runs! Free Dum Biryani served to MOTM.',
    isLive: false,
    newsTitle: 'Singarayakonda Box Turf League Grand Final Night!',
    newsSummary: 'Dhaba Strikers lifted the IPL Dhaba Champions Trophy at Singarayakonda floodlit arena!',
  },
];

export const CricketScoreCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedScorecard, setSelectedScorecard] = useState<ScoreCardItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_CRICKET_DATA.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const item = MOCK_CRICKET_DATA[currentIndex];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-2">
      {/* Live Cricket Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Live Cricket & Match Scores</span>
        </h3>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Auto-Sync
        </span>
      </div>

      {/* Main Scorecard / News Card Container */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-800 p-3.5 shadow-xl overflow-hidden group">
        {/* Glow Header Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />

        {/* Carousel Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Top Match Info Row */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {item.isLive ? (
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">
                    <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    RESULT
                  </span>
                )}
                <span className="text-[10px] font-extrabold text-amber-300 truncate uppercase tracking-tight">
                  {item.matchTitle}
                </span>
              </div>

              <button
                onClick={handleRefresh}
                className="text-slate-400 hover:text-amber-400 transition-colors p-1"
                title="Refresh Live Score"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            {/* Teams & Scores Row */}
            <div className="flex items-center justify-between gap-2 py-1">
              {/* Team 1 */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full ${item.team1.flagBg} flex items-center justify-center font-black text-[11px] text-white shadow-md border border-white/20 shrink-0`}>
                  {item.team1.code}
                </div>
                <div>
                  <div className="font-extrabold text-base text-white leading-tight">
                    {item.team1.score}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {item.team1.overs}
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                VS
              </div>

              {/* Team 2 */}
              <div className="flex items-center gap-2 text-right">
                <div>
                  <div className="font-extrabold text-base text-emerald-400 leading-tight">
                    {item.team2.score}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {item.team2.overs}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-full ${item.team2.flagBg} flex items-center justify-center font-black text-[11px] text-white shadow-md border border-white/20 shrink-0`}>
                  {item.team2.code}
                </div>
              </div>

              {/* Scorecard Action Button */}
              <button
                onClick={() => setSelectedScorecard(item)}
                className="bg-amber-500/10 hover:bg-amber-500 border border-amber-500/40 text-amber-400 hover:text-slate-950 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-sm shrink-0 ml-1"
              >
                SCORECARD
              </button>
            </div>

            {/* Bottom Status / Commentary Ticker */}
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-amber-300 font-medium truncate flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{item.statusText}</span>
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Navigation Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2.5">
          {MOCK_CRICKET_DATA.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                currentIndex === idx
                  ? 'w-6 bg-amber-400'
                  : 'w-1.5 bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Detailed Scorecard Modal */}
      <AnimatePresence>
        {selectedScorecard && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-5 text-white space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedScorecard(null)}
                className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-left space-y-1">
                <span className="text-[10px] bg-red-500/20 text-red-400 font-extrabold px-2 py-0.5 rounded border border-red-500/30">
                  LIVE MATCH SCORECARD
                </span>
                <h3 className="font-extrabold text-sm text-amber-400">{selectedScorecard.matchTitle}</h3>
                <p className="text-[10px] text-slate-400">{selectedScorecard.series}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs text-left">
                <div className="flex justify-between items-center font-black text-sm text-white">
                  <span>{selectedScorecard.team1.code}: {selectedScorecard.team1.score}</span>
                  <span className="text-emerald-400">{selectedScorecard.team2.code}: {selectedScorecard.team2.score}</span>
                </div>

                {selectedScorecard.scorecardDetails && (
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-300">
                    <p className="font-semibold"><b className="text-amber-300">Batting:</b> {selectedScorecard.scorecardDetails.team1Batter}</p>
                    <p className="font-semibold"><b className="text-emerald-400">Bowling:</b> {selectedScorecard.scorecardDetails.team1Bowler}</p>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>{selectedScorecard.scorecardDetails.crr}</span>
                      <span>{selectedScorecard.scorecardDetails.rrr}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30 font-medium">
                {selectedScorecard.statusText}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
