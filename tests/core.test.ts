import { describe, expect, it } from 'vitest';
import { GAME, TIERS } from '../src/config';
import { QUESTIONS, normalize, questionById } from '../src/core/answers';
import { validate } from '../src/core/validate';
import { resolveRarity, tierForPct } from '../src/core/rarity';
import { dailyQuestionIds, dayNumber, dayStart, nextResetAt } from '../src/core/schedule';
import { LIMIT_MS, advance, castAnswer, newCast, settleExpired, startQuestion, summarize, toggleWager, oddsFromCast } from '../src/core/game';
import { completeDay, liveStreak, freshSave, computeRecords, previousBest } from '../src/core/progress';
import { SPECIES } from '../src/content/creatures';

const q = (id: string) => questionById(id)!;
const pick = (id: string, input: string) => {
  const v = validate(q(id), input);
  return v.ok ? v.answer.name : null;
};

describe('normalisation and aliases', () => {
  it('ignores case, spacing, accents and punctuation', () => {
    expect(normalize('  CÔTE  d’Ivoire ')).toBe('cote divoire');
    expect(normalize('The Tempest')).toBe('tempest');
    expect(normalize('Romeo & Juliet')).toBe('romeo and juliet');
    expect(normalize('U.S.A.')).toBe('usa');
  });
  it('resolves country aliases to one canonical answer', () => {
    expect(pick('geo-africa', 'Ivory Coast')).toBe('Ivory Coast');
    expect(pick('geo-africa', "Côte d'Ivoire")).toBe('Ivory Coast');
    expect(pick('geo-africa', 'cote divoire')).toBe('Ivory Coast');
    expect(pick('geo-100-million', 'USA')).toBe('United States');
    expect(pick('geo-100-million', 'united states of america')).toBe('United States');
    expect(pick('geo-100-million', 'U.S.')).toBe('United States');
    expect(pick('geo-africa', 'Swaziland')).toBe('Eswatini');
  });
  it('accepts small typos but not different answers', () => {
    expect(pick('geo-africa', 'Kenia')).toBe('Kenya');
    expect(pick('geo-africa', 'Madagaskar')).toBe('Madagascar');
    expect(pick('geo-africa', 'Niger')).toBe('Niger');
    expect(pick('geo-africa', 'Nigeria')).toBe('Nigeria');
    expect(pick('geo-asia', 'Iran')).toBe('Iran');
    expect(pick('geo-asia', 'Iraq')).toBe('Iraq');
    expect(pick('geo-eu', 'Austria')).toBe('Austria');
    expect(pick('geo-eu', 'Australia')).toBeNull();
    expect(pick('geo-africa', 'France')).toBeNull();
  });
  it('handles plurals, suffixes and multi-word aliases', () => {
    expect(pick('ani-shark', 'great white')).toBe('Great white shark');
    expect(pick('ani-shark', 'Great White Shark')).toBe('Great white shark');
    expect(pick('ani-shark', 'hammerhead sharks')).toBe('Hammerhead shark');
    expect(pick('sci-bone', 'ribs')).toBe('Rib');
    expect(pick('nat-cloud', 'cumulus clouds')).toBe('Cumulus');
    expect(pick('food-nut', 'brazil nuts')).toBe('Brazil nut');
    expect(pick('gen-nato', 'xray')).toBe('X-ray');
    expect(pick('gen-currency', 'złoty')).toBe('Złoty');
  });
  it('rejects empty and wrong answers', () => {
    expect(validate(q('geo-africa'), '   ').ok).toBe(false);
    expect(pick('his-roman-emperor', 'Julius Caesar')).toBeNull();
    expect(pick('ani-flightless', 'chicken')).toBeNull();
    expect(pick('sci-planet', 'Sun')).toBeNull();
    expect(pick('gen-time-unit', 'light year')).toBeNull();
  });
  it('has no duplicate aliases and a sensible size for every question', () => {
    for (const question of QUESTIONS) {
      expect(question.answers.length).toBeGreaterThanOrEqual(7);
      const ids = new Set(question.answers.map((a) => a.id));
      expect(ids.size).toBe(question.answers.length);
    }
  });
});

describe('rarity', () => {
  it('maps frequencies to the configured tiers', () => {
    expect(tierForPct(30)).toBe('sardine');
    expect(tierForPct(29.99)).toBe('clownfish');
    expect(tierForPct(10)).toBe('clownfish');
    expect(tierForPct(9.99)).toBe('octopus');
    expect(tierForPct(3)).toBe('octopus');
    expect(tierForPct(2.99)).toBe('swordfish');
    expect(tierForPct(1)).toBe('swordfish');
    expect(tierForPct(0.99)).toBe('leviathan');
    expect(tierForPct(0)).toBe('leviathan');
  });
  it('uses labelled estimates below the minimum sample and real frequency above it', () => {
    const bf = q('geo-africa').answers.find((a) => a.id === 'burkina-faso')!;
    const few = resolveRarity(bf, { total: GAME.minSampleSize - 1, counts: { 'burkina-faso': 150 } });
    expect(few.source).toBe('estimate');
    expect(few.tier).toBe('leviathan');
    const many = resolveRarity(bf, { total: 1000, counts: { 'burkina-faso': 200 } });
    expect(many.source).toBe('players');
    expect(many.pct).toBe(20);
    expect(many.tier).toBe('clownfish');
    const none = resolveRarity(bf, null);
    expect(none.source).toBe('estimate');
  });
  it('measures each question separately', () => {
    const egypt = q('geo-africa').answers.find((a) => a.id === 'egypt')!;
    expect(resolveRarity(egypt, { total: 500, counts: { egypt: 2 } }).tier).toBe('leviathan');
  });
});

describe('daily schedule and reset', () => {
  it('resets at 00:00 UTC for everyone', () => {
    expect(dayNumber(GAME.epochUtc)).toBe(1);
    expect(dayNumber(GAME.epochUtc + 86_399_999)).toBe(1);
    expect(dayNumber(GAME.epochUtc + 86_400_000)).toBe(2);
    expect(nextResetAt(GAME.epochUtc + 5)).toBe(dayStart(2));
  });
  it('gives seven different, valid questions with varied topics each day, the same for all players', () => {
    for (let day = 1; day <= 60; day++) {
      const ids = dailyQuestionIds(day);
      expect(ids).toHaveLength(7);
      expect(new Set(ids).size).toBe(7);
      for (const id of ids) expect(questionById(id)).toBeTruthy();
      const topics = new Set(ids.map((id) => questionById(id)!.topic));
      expect(topics.size).toBeGreaterThanOrEqual(6);
      expect(dailyQuestionIds(day)).toEqual(ids);
    }
  });
  it('does not repeat a question within a cycle', () => {
    const days = Math.floor(QUESTIONS.length / 7);
    const seen = new Set<string>();
    for (let d = 1; d <= days; d++) for (const id of dailyQuestionIds(d)) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});

function play(answers: (string | null)[], wagerAt = -1) {
  let s = newCast(3, ['geo-africa', 'sci-planet', 'cul-greek-god', 'food-pasta', 'his-us-president', 'nat-tree', 'gen-greek-letter']);
  let t = 1_000_000;
  answers.forEach((a, i) => {
    s = startQuestion(s, t);
    if (i === wagerAt) s = toggleWager(s);
    t += a === null ? LIMIT_MS + 1000 : 5000;
    s = castAnswer(s, a ?? '', t).state;
    s = advance(s);
    t += 2000;
  });
  return s;
}

describe('a Daily Cast', () => {
  it('scores seven questions and totals the haul', () => {
    const s = play(['Burkina Faso', 'Mars', 'Zeus', 'Spaghetti', 'Lincoln', 'Oak', 'Alpha']);
    expect(s.status).toBe('complete');
    const sum = summarize(s);
    expect(sum.catches).toHaveLength(7);
    expect(sum.correct).toBe(7);
    expect(sum.totalKg).toBe(sum.catches.reduce((n, c) => n + c.kg, 0));
    expect(sum.rarest?.answerName).toBe('Burkina Faso');
    expect(oddsFromCast(sum)).toContain('pearl');
  });
  it('gives an Old Boot for a timeout, even if text was typed', () => {
    let s = newCast(1, ['geo-africa']);
    s = startQuestion(s, 0);
    const out = castAnswer(s, 'Egypt', LIMIT_MS + 5000);
    expect(out.record?.tier).toBe('boot');
    expect(out.record?.timedOut).toBe(true);
  });
  it('blocks a second answer to the same question', () => {
    let s = newCast(1, ['geo-africa', 'sci-planet']);
    s = startQuestion(s, 0);
    s = castAnswer(s, 'Egypt', 1000).state;
    const again = castAnswer(s, 'Burkina Faso', 1500);
    expect(again.rejected).toBe('duplicate');
    expect(again.state.catches).toHaveLength(1);
  });
  it('settles a question that expired while the app was closed', () => {
    let s = newCast(1, ['geo-africa', 'sci-planet']);
    s = startQuestion(s, 0);
    const out = settleExpired(s, LIMIT_MS + 10_000);
    expect(out.record?.tier).toBe('boot');
    expect(settleExpired(startQuestion(newCast(1, ['geo-africa']), 0), 5000).record).toBeNull();
  });
  it('doubles weight with a won wager without changing rarity, once per cast', () => {
    const s = play(['Burkina Faso', 'Mars', 'Zeus', 'Spaghetti', 'Lincoln', 'Oak', 'Alpha'], 0);
    const c = s.catches[0];
    expect(c.wager).toBe(true);
    expect(c.tier).toBe('leviathan');
    expect(c.baseKg).toBe(500);
    expect(c.kg).toBe(1000);
    expect(s.catches.filter((x) => x.wager)).toHaveLength(1);
    expect(summarize(s).wager).toBe('won');
    expect(oddsFromCast(summarize(s))).toContain('horseshoe');
    let t = newCast(1, ['geo-africa', 'sci-planet']);
    t = startQuestion(t, 0);
    t = toggleWager(t);
    t = advance(castAnswer(t, 'Egypt', 100).state);
    t = startQuestion(t, 200);
    expect(toggleWager(t).wagerArmed).toBe(false);
  });
  it('wastes the wager on a wrong answer', () => {
    const s = play(['France', 'Mars', 'Zeus', 'Spaghetti', 'Lincoln', 'Oak', 'Alpha'], 0);
    expect(s.catches[0].kg).toBe(0);
    expect(summarize(s).wager).toBe('lost');
  });
  it('awards weights from the tier table', () => {
    const s = play(['Egypt', null, 'Zeus', 'Spaghetti', 'Lincoln', 'Oak', 'Alpha']);
    for (const c of s.catches) expect(c.baseKg).toBe(TIERS.find((t) => t.id === c.tier)!.kg);
    expect(s.catches[1].tier).toBe('boot');
  });
});

describe('streaks and records', () => {
  it('counts consecutive days and keeps progress after a miss', () => {
    let st = { current: 0, best: 0, lastDay: 0 };
    st = completeDay(st, 1);
    st = completeDay(st, 2);
    st = completeDay(st, 2);
    expect(st.current).toBe(2);
    expect(liveStreak(st, 3)).toBe(2);
    expect(liveStreak(st, 4)).toBe(0);
    st = completeDay(st, 5);
    expect(st.current).toBe(1);
    expect(st.best).toBe(2);
  });
  it('computes records and the previous best', () => {
    const save = freshSave(0, 'abcd1234');
    save.history.push(summarize(play(['Egypt', 'Mars', 'Zeus', 'Spaghetti', 'Lincoln', 'Oak', 'Alpha'])));
    const r = computeRecords(save);
    expect(r.casts).toBe(1);
    expect(r.bestHaul?.kg).toBe(save.history[0].totalKg);
    expect(previousBest(save, 3)).toBeNull();
    expect(previousBest(save, 4)).toBe(save.history[0].totalKg);
  });
  it('has 40 fish variants and 6 oddities to collect', () => {
    expect(SPECIES.filter((s) => s.set !== 'oddities')).toHaveLength(40);
    expect(SPECIES).toHaveLength(46);
  });
});

describe('unfinished casts', () => {
  it('keeps catches from a cast left unfinished when the day ends', async () => {
    const { forfeitRest } = await import('../src/core/game');
    let s = newCast(1, ['geo-africa', 'sci-planet', 'cul-greek-god']);
    s = startQuestion(s, 0);
    s = advance(castAnswer(s, 'Egypt', 1000).state);
    const done = forfeitRest(s, 10_000_000);
    expect(done.status).toBe('complete');
    expect(done.catches).toHaveLength(3);
    expect(done.catches[0].answerName).toBe('Egypt');
    expect(done.catches.slice(1).every((c) => c.tier === 'boot')).toBe(true);
  });
});
