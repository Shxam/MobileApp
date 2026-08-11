import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from './AnimatedValue';
import { Radio, RefreshCw, Trophy, Zap, X, Activity, ChevronRight, Star } from 'lucide-react';

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

import { ApiClient } from '../services/apiClient';

const MOCK_CRICKET_DATA: ScoreCardItem[] = [
  {
    id: 'm1',
    type: 'score',
    matchTitle: 'RCB VS CSK • T20 MATCHDAY',
    series: 'INDIAN PREMIER LEAGUE 2026 • M CHINNASWAMY STADIUM',
    team1: { name: 'Bengaluru', code: 'RCB', score: '184/4', overs: '18.2 Overs', flagBg: 'bg-rose-600' },
    team2: { name: 'Chennai', code: 'CSK', score: '178/6', overs: '20.0 Overs', flagBg: 'bg-amber-500' },
    statusText: 'RCB need 7 runs in 10 balls to win',
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
    matchTitle: 'INDIA VS AUSTRALIA • 3RD T20I',
    series: 'AUSTRALIA TOUR OF INDIA 2026',
    team1: { name: 'India', code: 'IND', score: '208/5', overs: '20.0 Overs', flagBg: 'bg-blue-600' },
    team2: { name: 'Australia', code: 'AUS', score: '195/8', overs: '19.4 Overs', flagBg: 'bg-amber-400 text-slate-950' },
    statusText: 'IND lead series 2-1 • 14 runs needed off 2 balls',
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
    type: 'score',
    matchTitle: 'ENGLAND VS PAKISTAN • 2ND T20I',
    series: 'ENGLAND TOUR OF PAKISTAN 2026',
    team1: { name: 'England', code: 'ENG', score: '162/4', overs: '16.5 Overs', flagBg: 'bg-red-600' },
    team2: { name: 'Pakistan', code: 'PAK', score: '175/7', overs: '20.0 Overs', flagBg: 'bg-emerald-600' },
    statusText: 'England need 14 runs in 19 balls to win',
    isLive: true,
    scorecardDetails: {
      team1Batter: 'J. Buttler 58* (34) • L. Livingstone 29 (15)',
      team1Bowler: 'Shaheen Afridi 2/28 (3.5)',
      target: 'Target: 176',
      crr: 'CRR: 9.62',
      rrr: 'RRR: 4.42',
    },
  },
];

export const CricketScoreCarousel: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [matchData, setMatchData] = useState<ScoreCardItem[]>(MOCK_CRICKET_DATA);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedScorecard, setSelectedScorecard] = useState<ScoreCardItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLiveScores = async () => {
    try {
      const data = await ApiClient.getLiveCricketScores();
      if (data && Array.isArray(data) && data.length > 0) {
        // Exclude completed/over matches strictly
        const liveWorldwide = data.filter((m: any) => m.isLive && !/won|win by|awarded|abandoned|completed/i.test(m.statusText || ''));
        if (liveWorldwide.length > 0) {
          setMatchData(liveWorldwide);
        } else {
          setMatchData(data);
        }
      }
    } catch {
      // Keep active live worldwide default matches
    }
  };

  useEffect(() => {
    fetchLiveScores();
    const fetchTimer = setInterval(fetchLiveScores, 15000);
    return () => clearInterval(fetchTimer);
  }, []);

  useEffect(() => {
    if (matchData.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matchData.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [matchData.length]);

  const item = matchData[currentIndex] || MOCK_CRICKET_DATA[0];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLiveScores();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-2">
      {/* Live Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Live Match Scores & Ticker
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Auto-Sync
        </span>
      </div>

      {/* Main Scorecard Feature Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 relative overflow-hidden">
        {/* Carousel Slide Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Top Match Info Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {item.isLive ? (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 shadow-xs">
                    <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                    LIVE MATCH
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    MATCH RESULT
                  </span>
                )}
                <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 truncate">
                  {item.matchTitle}
                </span>
              </div>

              {/* Refresh Score Button */}
              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                title="Refresh Live Score"
              >
                <motion.span animate={isRefreshing && !shouldReduceMotion ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.8, ease: 'linear' }}>
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'text-emerald-500' : ''}`} />
                </motion.span>
              </button>
            </div>

            {/* Teams & Score Metrics Row */}
            <div className="flex items-center justify-between gap-2 py-1">
              {/* Team 1 */}
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-full ${item.team1.flagBg} flex items-center justify-center font-black text-xs text-white shadow-xs shrink-0 border border-white/20`}>
                  {item.team1.code}
                </div>
                <div>
                  <div className="font-black text-lg text-slate-900 dark:text-white leading-tight">
                    <AnimatedValue value={item.team1.score} />
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {item.team1.overs}
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 shrink-0">
                VS
              </div>

              {/* Team 2 */}
              <div className="flex items-center gap-2.5 text-right">
                <div>
                  <div className="font-black text-lg text-slate-900 dark:text-white leading-tight">
                    <AnimatedValue value={item.team2.score} />
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {item.team2.overs}
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-full ${item.team2.flagBg} flex items-center justify-center font-black text-xs text-white shadow-xs shrink-0 border border-white/20`}>
                  {item.team2.code}
                </div>
              </div>
            </div>

            {/* Live Ticker & Action Button */}
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold truncate min-w-0">
                <Zap className="w-4 h-4 text-emerald-500 shrink-0 fill-emerald-500" />
                <span className="truncate">{item.statusText}</span>
              </div>

              <button
                onClick={() => setSelectedScorecard(item)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-full shadow-green-sm active:scale-95 transition-all shrink-0 flex items-center gap-1"
              >
                <span>Scorecard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {matchData.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                currentIndex === idx ? 'w-6 bg-emerald-500 shadow-green-sm' : 'w-1.5 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* FULL SCORECARD MODAL */}
      <AnimatePresence>
        {selectedScorecard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl relative text-slate-900 dark:text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">{selectedScorecard.matchTitle}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{selectedScorecard.series}</p>
                </div>
                <button
                  onClick={() => setSelectedScorecard(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scorecard Detailed Stats */}
              {selectedScorecard.scorecardDetails && (
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3 space-y-1.5">
                    <div className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase">Batting Crease</div>
                    <div className="font-extrabold text-slate-900 dark:text-white">{selectedScorecard.scorecardDetails.team1Batter}</div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3 space-y-1.5">
                    <div className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase">Current Bowler</div>
                    <div className="font-extrabold text-slate-900 dark:text-white">{selectedScorecard.scorecardDetails.team1Bowler}</div>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-2xl text-emerald-900 dark:text-emerald-200 font-extrabold">
                    <span>{selectedScorecard.scorecardDetails.crr}</span>
                    <span>{selectedScorecard.scorecardDetails.rrr || selectedScorecard.scorecardDetails.target}</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedScorecard(null)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full shadow-green-sm text-xs"
              >
                Close Scorecard
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
