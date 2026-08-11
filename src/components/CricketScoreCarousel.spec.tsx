import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LiveMatchItem } from '../types';
import { CricketScoreCarousel } from './CricketScoreCarousel';
import { ApiClient } from '../services/apiClient';

/**
 * Guards the honest-state behaviour of the carousel.
 *
 * This component used to render three hardcoded matches — a fabricated Kohli
 * innings under a LIVE MATCH badge — which stayed on screen when the upstream
 * feed was down or out of season. The states asserted below are what replaced
 * that, and they are only observable through the DOM, so this is the first test
 * that needed the jsdom project.
 */

const match = (over: Partial<LiveMatchItem> = {}): LiveMatchItem => ({
  id: 'match_1',
  matchTitle: 'IND vs AUS',
  series: 'Border-Gavaskar Trophy',
  team1: { name: 'India', code: 'IND', score: '182/4', overs: '18.2 ov', flagBg: 'bg-blue-600' },
  team2: { name: 'Australia', code: 'AUS', score: '178/9', overs: '20 ov', flagBg: 'bg-yellow-500' },
  statusText: 'India need 4 runs from 10 balls',
  isLive: true,
  ...over,
});

describe('CricketScoreCarousel', () => {
  let getLiveCricketScores: jest.SpyInstance;

  beforeEach(() => {
    getLiveCricketScores = jest.spyOn(ApiClient, 'getLiveCricketScores');
  });

  afterEach(() => {
    // The component polls on a 15s interval; without this the timer outlives
    // the test and fires against an unmounted tree.
    jest.clearAllTimers();
  });

  it('says it is connecting before the first response arrives', () => {
    getLiveCricketScores.mockReturnValue(new Promise(() => {}));

    render(<CricketScoreCarousel />);

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByText('Loading live scores…')).toBeInTheDocument();
  });

  it('reports no feed rather than inventing a match when the API returns nothing', async () => {
    getLiveCricketScores.mockResolvedValue([]);

    render(<CricketScoreCarousel />);

    expect(await screen.findByText('No live matches right now')).toBeInTheDocument();
    expect(screen.getByText('No feed')).toBeInTheDocument();
    // The critical assertion: nothing may claim to be live when there is no data.
    expect(screen.queryByText('LIVE MATCH')).not.toBeInTheDocument();
  });

  it('keeps the last good scores up when a refresh fails', async () => {
    getLiveCricketScores.mockResolvedValueOnce([match()]);
    render(<CricketScoreCarousel />);
    expect(await screen.findByText('IND vs AUS')).toBeInTheDocument();

    getLiveCricketScores.mockRejectedValueOnce(new Error('upstream down'));
    await userEvent.click(screen.getByTitle('Refresh Live Score'));

    await waitFor(() => expect(getLiveCricketScores).toHaveBeenCalledTimes(2));
    expect(screen.getByText('IND vs AUS')).toBeInTheDocument();
  });

  it('renders a finished match as a result, not as live', async () => {
    getLiveCricketScores.mockResolvedValue([
      match({ isLive: false, statusText: 'India won by 6 wickets' }),
    ]);

    render(<CricketScoreCarousel />);

    expect(await screen.findByText('MATCH RESULT')).toBeInTheDocument();
    expect(screen.queryByText('LIVE MATCH')).not.toBeInTheDocument();
  });

  it('hides the dots for a single match and shows one per match otherwise', async () => {
    getLiveCricketScores.mockResolvedValue([match()]);
    const { unmount } = render(<CricketScoreCarousel />);
    expect(await screen.findByText('IND vs AUS')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Show /)).not.toBeInTheDocument();
    unmount();

    getLiveCricketScores.mockResolvedValue([match(), match({ id: 'match_2', matchTitle: 'CSK vs MI' })]);
    render(<CricketScoreCarousel />);

    await waitFor(() => expect(screen.getAllByLabelText(/^Show /)).toHaveLength(2));
  });

  /**
   * The bug this component shipped with: `matchData[currentIndex]` after a
   * refresh returned fewer matches read past the end of the array and crashed on
   * `item.team1`. Rotating to the last of three and then shrinking to one is the
   * exact sequence that triggered it.
   */
  it('survives a refresh that returns fewer matches than are showing', async () => {
    const three = [
      match(),
      match({ id: 'match_2', matchTitle: 'CSK vs MI' }),
      match({ id: 'match_3', matchTitle: 'RCB vs KKR' }),
    ];
    getLiveCricketScores.mockResolvedValueOnce(three);
    render(<CricketScoreCarousel />);

    const dots = await screen.findAllByLabelText(/^Show /);
    await userEvent.click(dots[2]);
    expect(await screen.findByText('RCB vs KKR')).toBeInTheDocument();

    getLiveCricketScores.mockResolvedValueOnce([match()]);
    await userEvent.click(screen.getByTitle('Refresh Live Score'));

    // Clamped back to the only remaining card instead of throwing on undefined.
    expect(await screen.findByText('IND vs AUS')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Show /)).not.toBeInTheDocument();
  });
});
