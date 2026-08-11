import React, { useCallback, useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from './AnimatedValue';
import { Radio, RefreshCw, Trophy, Zap, X, Activity, ChevronRight, Loader2 } from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import type { LiveMatchItem } from '../types';

export const CricketScoreCarousel: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  /**
   * Starts empty. This used to be seeded with three invented matches — Kohli on
   * 78*, a 2-1 India series lead — which rendered under a LIVE MATCH badge and
   * stayed on screen whenever the upstream feed was down or out of season. An
   * empty carousel that says so is the honest state.
   */
  const [matchData, setMatchData] = useState<LiveMatchItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedScorecard, setSelectedScorecard] = useState<LiveMatchItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchLiveScores = useCallback(async () => {
    try {
      const data = await ApiClient.getLiveCricketScores();
      // Live matches lead; a finished one still renders, under a MATCH RESULT
      // badge, so the card is never captioned as something it is not.
      const live = data.filter(
        (m) => m.isLive && !/won|win by|awarded|abandoned|completed/i.test(m.statusText || ''),
      );
      setMatchData(live.length > 0 ? live : data);
    } catch {
      // Leave the last good scores up; the refresh button retries on demand.
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchLiveScores();
    const fetchTimer = setInterval(fetchLiveScores, 15000);
    return () => clearInterval(fetchTimer);
  }, [fetchLiveScores]);

  useEffect(() => {
    if (matchData.length === 0) return;
    // A refresh that returns fewer matches must not leave the rotation index
    // past the end of the new array.
    setCurrentIndex((prev) => Math.min(prev, matchData.length - 1));
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matchData.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [matchData.length]);

  // Clamp on a shrink: a refresh that returns fewer matches must not leave the
  // rotation index pointing past the end of the new array.
  const safeIndex = Math.min(currentIndex, Math.max(0, matchData.length - 1));
  const item = matchData[safeIndex];

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
        {/*
          Reflects the real fetch state. It used to read "Auto-Sync" with a
          pinging dot unconditionally — including while the feed was empty or the
          upstream was down, which read as a live connection that wasn't there.
        */}
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700">
          {matchData.length > 0 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Auto-Sync
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              {hasLoaded ? 'No feed' : 'Connecting'}
            </>
          )}
        </span>
      </div>

      {/* Main Scorecard Feature Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 relative overflow-hidden">
        {!item ? (
          /*
           * The two honest states the old mock array hid. Before, three invented
           * matches sat here permanently, so a down feed or an off-season day
           * looked exactly like live cricket.
           */
          <div className="flex flex-col items-center justify-center gap-2 py-7 text-center">
            {!hasLoaded ? (
              <>
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  Loading live scores…
                </span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    No live matches right now
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Scores appear here as soon as a match is underway.
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  className="mt-1 inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-[11px] px-3.5 py-1.5 rounded-full active:scale-95 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
                  <span>Check again</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <>
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

        {/* Carousel Dots — only when there is more than one card to move between. */}
        {matchData.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {matchData.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Show ${m.matchTitle}`}
                className={`h-1.5 rounded-full transition-all ${
                  safeIndex === idx ? 'w-6 bg-emerald-500 shadow-green-sm' : 'w-1.5 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}
          </>
        )}
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
