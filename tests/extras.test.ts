import { describe, expect, it } from 'vitest';
import { GAME } from '../src/config';
import { ABYSS, SEASONAL, SPECIES, speciesById } from '../src/content/creatures';
import { LOG_PAGES } from '../src/content/lore';
import {
  applyFreezes, buildMods, buyUpgrade, claimExhibits, claimOrder, earnFreeze, missedDays, orderFor, orderProgress, pagesUnlocked, pendingMilestone, celebrate,
  placeStreakWager, rankFor, resolveStreakWager, sevenDayTarget, sonarHint, tideFor, weatherFor, leavingSoon, type CastMods,
} from '../src/core/extras';
import { questionById } from '../src/core/answers';
import { advance, castAnswer, forfeitRest, newCast, remainingMs, startQuestion, summarize, type CastSummary } from '../src/core/game';
import { completeDay, freshSave, type SaveData } from '../src/core/progress';
import { dayStart } from '../src/core/schedule';

const save = (): SaveData => freshSave(0, 'abcdef0123456789');

/** A cast of one question with chosen modifiers, answered `secondsIn` after it starts. */
function play(mods: Partial<CastMods>, answer: string, secondsIn = 10, day = 10, qid = 'geo-africa', startAt = dayStart(day) + 12 * 3600_000) {
  const base = buildMods(save(), day, 'daily', null, 0);
  let s = newCast(day, [qid], { ...base, luck: false, tide: null, shinyOdds: 1e9, ...mods });
  s = startQuestion(s, startAt);
  return castAnswer(s, answer, startAt + secondsIn * 1000);
}

function summary(day: number, kg = 100, kind: 'daily' | 'archive' = 'daily', playedOn = day): CastSummary {
  return { day, totalKg: kg, correct: 5, catches: [], rarest: null, heaviest: null, wager: 'unused', legendaries: 0, kind, playedOn };
}

describe('catch modifiers', () => {
  it('bait doubles its topic only', () => {
    expect(play({ bait: 'geography' }, 'Egypt').record!.kg).toBe(10);
    expect(play({ bait: 'science' }, 'Egypt').record!.kg).toBe(5);
    expect(play({ bait: 'geography' }, 'Egypt').record!.mults!.map((m) => m.label)).toContain('Geography bait');
  });
  it('the Surprise Tide doubles catches made inside its window', () => {
    const day = 10;
    const tide = tideFor(day);
    const inside = play({ tide }, 'Egypt', 10, day, 'geo-africa', tide.start + 60_000);
    const outside = play({ tide }, 'Egypt', 10, day, 'geo-africa', tide.end + 60_000);
    expect(inside.record!.kg).toBe(10);
    expect(outside.record!.kg).toBe(5);
  });
  it('tides fall between 07:00 and 21:00 UTC and last 90 minutes', () => {
    for (let d = 1; d < 200; d++) {
      const t = tideFor(d);
      expect(t.end - t.start).toBe(90 * 60_000);
      expect(t.start).toBeGreaterThanOrEqual(dayStart(d) + 7 * 3600_000);
      expect(t.end).toBeLessThanOrEqual(dayStart(d) + 21 * 3600_000);
    }
  });
  it('missed-day casts weigh half', () => {
    expect(play({ kind: 'archive' }, 'Kenya').record!.kg).toBe(13);
  });
  it('beginner’s luck lifts the first correct answer to an Octopus, once', () => {
    const base = buildMods(save(), 10, 'daily', null, 0);
    expect(base.luck).toBe(true);
    let s = newCast(10, ['geo-africa', 'geo-south-america'], { ...base, tide: null, shinyOdds: 1e9 });
    s = startQuestion(s, 0);
    const a = castAnswer(s, 'Egypt', 10_000);
    expect(a.record!.tier).toBe('octopus');
    expect(a.record!.boost).toBe('luck');
    s = startQuestion(advance(a.state), 20_000);
    const b = castAnswer(s, 'Brazil', 30_000);
    expect(b.record!.tier).toBe('sardine');
    expect(b.record!.boost).toBeUndefined();
  });
  it('a correct answer within 5 seconds is a Mutant; a rare roll is Shiny', () => {
    const m = play({}, 'Egypt', 3).record!;
    expect(m.variant).toBe('mutant');
    expect(m.species).toBe('mutant:clownfish');
    expect(m.kg).toBe(8);
    const s = play({ shinyOdds: 1 }, 'Egypt', 3).record!;
    expect(s.variant).toBe('shiny');
    expect(speciesById(s.species)?.name).toBe('Shiny Clownfish');
  });
  it('night catches depend on the player’s local hour', () => {
    // 03:00 UTC, player at UTC+2 (offset -120) → 05:00 local: night
    const at3 = dayStart(10) + 3 * 3600_000;
    const n = play({ tz: -120 }, 'Egypt', 10, 10, 'geo-africa', at3).record!;
    expect(n.variant).toBe('night');
    // same instant, player at UTC-10 → 17:00 the day before: not night
    const d = play({ tz: 600 }, 'Egypt', 10, 10, 'geo-africa', at3).record!;
    expect(d.variant).toBeUndefined();
  });
  it('wrong answers stay Old Boots, salvaged by the net', () => {
    expect(play({ salvageKg: 15 }, 'France').record!.kg).toBe(15);
    expect(play({}, 'France').record!.kg).toBe(0);
  });
  it('the Long Rod adds time', () => {
    const mods = { ...buildMods(save(), 1, 'daily', null, 0), limitMs: (GAME.secondsPerQuestion + 4) * 1000 };
    const s = startQuestion(newCast(1, ['geo-africa'], mods), 0);
    expect(remainingMs(s, 0)).toBe(24_000);
    expect(castAnswer(s, 'Egypt', 22_000).record!.tier).not.toBe('boot');
  });
  it('abyss creatures need enough lifetime catches; seasonal visitors need their month', () => {
    let abyss = 0, seasonal = 0;
    for (let seed = 1; seed < 400; seed++) {
      // Tunisia is a Swordfish; in December the Mistral (Mar–Apr) and Meltemi (Aug–Sep) are out of season
      const r = play({ seed, lifetime: 30 }, 'Tunisia', 10, 10, 'geo-africa', Date.UTC(2026, 11, 3, 12)).record!;
      if (r.special === 'abyss') { abyss++; expect(r.species).toBe('abyss:ghost'); }
      if (r.special === 'seasonal') seasonal++;
    }
    expect(abyss).toBeGreaterThan(60);
    expect(seasonal).toBe(0);
    const none = play({ seed: 3, lifetime: 0 }, 'Tunisia', 10).record!;
    expect(none.special).not.toBe('abyss');
  });
  it('rolls are fixed by the seed, so replaying gives the same catch', () => {
    const a = play({ seed: 42, shinyOdds: 2 }, 'Egypt').record!;
    const b = play({ seed: 42, shinyOdds: 2 }, 'Egypt').record!;
    expect(a.species).toBe(b.species);
    expect(a.kg).toBe(b.kg);
  });
  it('an unfinished cast with mods still forfeits cleanly', () => {
    const mods = buildMods(save(), 1, 'daily', 'science', 0);
    const s = forfeitRest(newCast(1, ['geo-africa', 'sci-planet'], mods), 0);
    expect(s.status).toBe('complete');
    expect(summarize(s).totalKg).toBe(0);
  });
});

describe('creatures', () => {
  it('every species id is unique and every special has a look', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    for (const s of SPECIES.filter((x) => ['variants', 'seasonal', 'abyss'].includes(x.set))) expect(s.look).toBeTruthy();
  });
  it('every month has at least one seasonal visitor', () => {
    for (let m = 0; m < 12; m++) expect(SEASONAL.some((v) => v.months.includes(m))).toBe(true);
  });
  it('abyss unlocks go up', () => {
    expect(ABYSS.map((a) => a.unlockAt)).toEqual([25, 75, 150]);
  });
});

describe('streak freezes', () => {
  it('earns one every 7 days, up to two', () => {
    const sv = save();
    for (let d = 1; d <= 21; d++) {
      sv.streak = completeDay(sv.streak, d);
      earnFreeze(sv);
    }
    expect(sv.freezes).toBe(2);
  });
  it('covers missed days when there are enough freezes', () => {
    const sv = save();
    sv.streak = { current: 9, best: 9, lastDay: 20 };
    sv.freezes = 2;
    expect(applyFreezes(sv, 23)).toBe(2);
    expect(sv.streak.lastDay).toBe(22);
    expect(sv.freezes).toBe(0);
    expect(sv.frozenDays).toEqual([21, 22]);
    sv.streak = completeDay(sv.streak, 23);
    expect(sv.streak.current).toBe(10);
  });
  it('does nothing if there aren’t enough', () => {
    const sv = save();
    sv.streak = { current: 9, best: 9, lastDay: 20 };
    sv.freezes = 1;
    expect(applyFreezes(sv, 23)).toBe(0);
    expect(sv.freezes).toBe(1);
  });
});

describe('Streak Wager', () => {
  it('pays double for seven Daily Casts in a row', () => {
    const sv = save();
    sv.purse = 300;
    expect(placeStreakWager(sv, 5, 250)).toBe(true);
    expect(sv.purse).toBe(50);
    for (let d = 5; d < 12; d++) sv.history.push(summary(d));
    expect(resolveStreakWager(sv, 11)).toBe('won');
    expect(sv.purse).toBe(550);
  });
  it('is lost on a missed day, and missed-day casts don’t save it', () => {
    const sv = save();
    sv.purse = 300;
    placeStreakWager(sv, 5, 100);
    sv.history.push(summary(5), summary(6, 100, 'archive', 8));
    expect(resolveStreakWager(sv, 7)).toBe('lost');
    expect(sv.streakWager).toBeNull();
  });
});

describe('orders, ranks, log, targets', () => {
  it('orders are the same for everyone in a week and pay once', () => {
    expect(orderFor(3)).toEqual(orderFor(3));
    const sv = save();
    const o = orderFor(0);
    expect(orderProgress(o, sv)).toBe(0);
    expect(claimOrder(sv, 1)).toBe(0);
  });
  it('ranks climb with lifetime kilos', () => {
    expect(rankFor(0).rank.name).toBe('Deckhand');
    expect(rankFor(1000).rank.name).toBe('Navigator');
    expect(rankFor(999_999).next).toBeNull();
  });
  it('a log page opens every few Daily Casts', () => {
    const sv = save();
    expect(pagesUnlocked(sv)).toBe(0);
    sv.history.push(summary(1));
    expect(pagesUnlocked(sv)).toBe(1);
    for (let d = 2; d <= 100; d++) sv.history.push(summary(d));
    expect(pagesUnlocked(sv)).toBe(LOG_PAGES.length);
  });
  it('the 7-day target averages the last seven Daily Casts', () => {
    const sv = save();
    expect(sevenDayTarget(sv, 5)).toBeNull();
    for (let d = 1; d <= 9; d++) sv.history.push(summary(d, d * 10));
    expect(sevenDayTarget(sv, 10)).toBe(60);
  });
  it('missed days skip days already played', () => {
    const sv = save();
    sv.history.push(summary(3), summary(5));
    expect(missedDays(sv, 6)).toEqual([4, 2, 1]);
  });
  it('milestones are celebrated once', () => {
    const sv = save();
    sv.streak = { current: 8, best: 8, lastDay: 8 };
    const m = pendingMilestone(sv)!;
    expect(m.days).toBe(7);
    celebrate(sv, m);
    expect(sv.purse).toBe(300);
    expect(pendingMilestone(sv)).toBeNull();
  });
  it('a storm after a missed day, gold on a long streak', () => {
    const sv = save();
    sv.streak = { current: 3, best: 3, lastDay: 4 };
    expect(weatherFor(sv, 7)).toBe('storm');
    sv.streak = { current: 9, best: 9, lastDay: 6 };
    expect(weatherFor(sv, 7)).toBe('golden');
  });
  it('upgrades cost kilos from the hold', () => {
    const sv = save();
    expect(buyUpgrade(sv, 'rod')).toBe(false);
    sv.purse = 400;
    expect(buyUpgrade(sv, 'rod')).toBe(true);
    expect(sv.upgrades.rod).toBe(1);
    expect(sv.purse).toBe(0);
  });
  it('completing an exhibit pays once', () => {
    const sv = save();
    for (const s of SPECIES.filter((x) => x.set === 'oddities')) sv.found[s.id] = { first: 0, count: 1 };
    expect(claimExhibits(sv)).toEqual(['Oddities']);
    expect(claimExhibits(sv)).toEqual([]);
  });
  it('sonar points at a real, rare answer', () => {
    const q = questionById('geo-africa')!;
    const h = sonarHint(q, 4);
    expect(q.answers.some((a) => a.name.toUpperCase().startsWith(h.letter) && a.est < 3)).toBe(true);
  });
  it('flags seasonal visitors in their last month', () => {
    const sv = save();
    // 20 Nov: the Gloom Octopus (Oct–Nov) is leaving
    const l = leavingSoon(sv, Date.UTC(2026, 10, 20, 12), 0);
    expect(l.map((x) => x.id)).toContain('season:gloom');
    expect(l[0].daysLeft).toBe(11);
  });
});
