import axios from "axios";

/**
 * ================= CONFIG =================
 */
const ODDS_API_KEY = "d30c24900890b5ab4d183702ceda9a91"; // The Odds API
const SPORTS_DATA_IO_KEY = "e1bc5f247c8748749754a25599a514ac"; // SportsDataIO

const SPORT = "americanfootball_nfl";
const REGIONS = "us";
const MARKETS = "h2h";
const STAKE = 5;

const CURRENT_SEASON = 2025;
const BASE_HOME_EDGE = 0.04;

// -------- League-average fallbacks --------
const LG_AVG_PFPG = 22.5;
const LG_AVG_PAPG = 22.5;
const LG_AVG_OFF_YPP = 5.6;
const LG_AVG_DEF_YPP = 5.6;
const LG_AVG_QB_EFF = 0.55;

/**
 * ================= TEAM NAME NORMALIZATION =================
 */
const NAME_ALIASES = new Map([
  ["BUF", "Buffalo Bills"],
  ["MIA", "Miami Dolphins"],
  ["NE", "New England Patriots"],
  ["NYJ", "New York Jets"],
  ["BAL", "Baltimore Ravens"],
  ["CIN", "Cincinnati Bengals"],
  ["CLE", "Cleveland Browns"],
  ["PIT", "Pittsburgh Steelers"],
  ["HOU", "Houston Texans"],
  ["IND", "Indianapolis Colts"],
  ["JAX", "Jacksonville Jaguars"],
  ["TEN", "Tennessee Titans"],
  ["DEN", "Denver Broncos"],
  ["KC", "Kansas City Chiefs"],
  ["LV", "Las Vegas Raiders"],
  ["LAC", "Los Angeles Chargers"],
  ["DAL", "Dallas Cowboys"],
  ["NYG", "New York Giants"],
  ["PHI", "Philadelphia Eagles"],
  ["WSH", "Washington Commanders"],
  ["WAS", "Washington Commanders"],
  ["CHI", "Chicago Bears"],
  ["DET", "Detroit Lions"],
  ["GB", "Green Bay Packers"],
  ["MIN", "Minnesota Vikings"],
  ["ATL", "Atlanta Falcons"],
  ["CAR", "Carolina Panthers"],
  ["NO", "New Orleans Saints"],
  ["TB", "Tampa Bay Buccaneers"],
  ["ARI", "Arizona Cardinals"],
  ["LAR", "Los Angeles Rams"],
  ["SF", "San Francisco 49ers"],
  ["SEA", "Seattle Seahawks"],
  ["Las Vegas", "Las Vegas Raiders"],
  ["Raiders", "Las Vegas Raiders"],
  ["Washington", "Washington Commanders"],
  ["Washington Football Team", "Washington Commanders"],
]);

function normalizeTeam(name) {
  if (!name) return name;
  const trimmed = String(name).trim();
  if (NAME_ALIASES.has(trimmed)) return NAME_ALIASES.get(trimmed);
  for (const [k, v] of NAME_ALIASES.entries())
    if (k.toLowerCase() === trimmed.toLowerCase()) return v;
  return trimmed;
}

/**
 * ================= WEEK CALCULATOR =================
 */
const SEASON_START = new Date("2025-09-04T00:00:00Z");
function getNFLWeek(date) {
  const kickoff = new Date(date);
  if (isNaN(kickoff.getTime())) return 1;
  const diffDays = Math.floor((kickoff - SEASON_START) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(18, Math.floor(diffDays / 7) + 1));
}

/**
 * ================= HELPERS =================
 */
const clamp01 = (x) => Math.max(0.01, Math.min(0.99, x));
const safe = (v, d = 0) => (v == null || Number.isNaN(v) ? d : v);
const firstNonNull = (obj, keys, d = 0) => {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return d;
};
const uc = (s) => (s ? String(s).toUpperCase() : "");

// Odds utils
function americanToDecimal(odds) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}
function decimalToAmerican(dec) {
  if (!dec || Number.isNaN(dec)) return 100; // fallback
  return dec >= 2.0
    ? Math.round((dec - 1) * 100)
    : Math.round(-100 / (dec - 1));
}
function impliedProbability(americanOdds) {
  if (!americanOdds || Number.isNaN(americanOdds)) return 0.5;
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}
function calcEV(americanOdds, winProb, stake) {
  const dec = americanToDecimal(americanOdds);
  const profit = (dec - 1) * stake;
  return winProb * profit - (1 - winProb) * stake;
}

/**
 * ================= SPORTS DATA IO =================
 */
async function getStandings(seasonCode) {
  try {
    const url = `https://api.sportsdata.io/v3/nfl/scores/json/Standings/${seasonCode}?key=${SPORTS_DATA_IO_KEY}`;
    const { data } = await axios.get(url, { timeout: 20000 });
    return data || [];
  } catch (err) {
    console.warn("⚠️ Standings fetch failed:", err.message);
    return [];
  }
}
async function getTeamSeasonStats(seasonCode) {
  try {
    const url = `https://api.sportsdata.io/v3/nfl/stats/json/TeamSeasonStats/${seasonCode}?key=${SPORTS_DATA_IO_KEY}`;
    const { data } = await axios.get(url, { timeout: 20000 });
    return data || [];
  } catch (err) {
    console.warn("⚠️ Stats fetch failed:", err.message);
    return [];
  }
}

/**
 * ================= BUILD TEAM DB =================
 */
function buildTeamDb(standings, stats) {
  const statsById = new Map();
  const statsByKey = new Map();
  const statsByName = new Map();

  for (const s of stats || []) {
    const id = safe(s.TeamID, null);
    const key = uc(firstNonNull(s, ["Team", "Key", "TeamKey", "TeamAbbr"], ""));
    const name = normalizeTeam(
      firstNonNull(s, ["FullName", "Name", "TeamName"], "")
    );
    if (id != null) statsById.set(id, s);
    if (key) statsByKey.set(key, s);
    if (name) statsByName.set(name, s);
  }

  const db = {};
  for (const row of standings || []) {
    const name = normalizeTeam(row.FullName || row.Team || row.Key);
    if (!name) continue;

    const key = uc(row.Key || row.Team);
    const id = safe(row.TeamID, null);

    const s =
      (id != null && statsById.get(id)) ||
      (key && statsByKey.get(key)) ||
      (name && statsByName.get(name)) ||
      {};

    const wins = safe(row.Wins, 0);
    const losses = safe(row.Losses, 0);
    const ties = safe(row.Ties, 0);
    const games = Math.max(0, wins + losses + ties, safe(s.Games, 0));

    const pfTotal =
      safe(firstNonNull(row, ["PointsFor", "PF"], null), null) ??
      safe(firstNonNull(s, ["PointsFor"], 0), 0);

    const paTotal =
      safe(firstNonNull(row, ["PointsAgainst", "PA"], null), null) ??
      safe(firstNonNull(s, ["PointsAgainst"], 0), 0);

    const offensivePlays = safe(firstNonNull(s, ["OffensivePlays"], 0), 0);
    const defensivePlays = safe(firstNonNull(s, ["DefensivePlays"], 0), 0);
    const offensiveYards = safe(firstNonNull(s, ["OffensiveYards"], 0), 0);
    const yardsAllowed = safe(firstNonNull(s, ["YardsAllowed"], 0), 0);

    const takeaways = safe(firstNonNull(s, ["Takeaways"], 0), 0);
    const giveaways = safe(firstNonNull(s, ["Giveaways"], 0), 0);

    const qbRatingRaw = safe(
      firstNonNull(s, ["QBRating", "QuarterbackRating", "PasserRating"], 0),
      0
    );
    const qbEff = qbRatingRaw > 0 ? qbRatingRaw / 100 : LG_AVG_QB_EFF;

    const regW = Math.min(1, games / 8);

    let pfpg = pfTotal > 0 && games > 0 ? pfTotal / games : LG_AVG_PFPG;
    let papg = paTotal > 0 && games > 0 ? paTotal / games : LG_AVG_PAPG;
    pfpg = regW * pfpg + (1 - regW) * LG_AVG_PFPG;
    papg = regW * papg + (1 - regW) * LG_AVG_PAPG;

    let offYPP =
      offensivePlays > 0 ? offensiveYards / offensivePlays : LG_AVG_OFF_YPP;
    let defYPP =
      defensivePlays > 0 ? yardsAllowed / defensivePlays : LG_AVG_DEF_YPP;
    offYPP = regW * offYPP + (1 - regW) * LG_AVG_OFF_YPP;
    defYPP = regW * defYPP + (1 - regW) * LG_AVG_DEF_YPP;

    const toDiffPg = games > 0 ? (takeaways - giveaways) / games : 0;

    db[name] = {
      games,
      winPct: games > 0 ? wins / games : 0.5,
      pfpg,
      papg,
      offYPP,
      defYPP,
      toDiffPg,
      qbEff,
      reliability: Math.min(1, games / 17),
    };
  }
  return db;
}

function blendTeams(t25, t24) {
  if (!t25 && !t24) return null;
  if (!t24) return t25;
  if (!t25) return t24;

  const w = Math.max(0, Math.min(1, (t25.games ?? 0) / 17));
  const blend = (a, b) => w * safe(a, b) + (1 - w) * safe(b, a);

  return {
    winPct: blend(t25.winPct, t24.winPct),
    pfpg: blend(t25.pfpg, t24.pfpg),
    papg: blend(t25.papg, t24.papg),
    offYPP: blend(t25.offYPP, t24.offYPP),
    defYPP: blend(t25.defYPP, t24.defYPP),
    toDiffPg: blend(t25.toDiffPg, t24.toDiffPg),
    qbEff: blend(t25.qbEff, t24.qbEff),
    reliability: w,
  };
}

/**
 * ================= TEMPERING FACTOR =================
 */
function getTemperingFactor(week) {
  if (week <= 4) return 0.65;
  if (week <= 10) return 0.75;
  if (week <= 14) return 0.85;
  return 0.9;
}

/**
 * ================= MODEL =================
 */
function modelNFLProb({ team, opp, isHome, week }) {
  let p = 0.5;

  p += 0.35 * (team.winPct - opp.winPct);
  p += (0.15 * (team.pfpg - team.papg - (opp.pfpg - opp.papg))) / 14;
  p += (0.15 * (team.offYPP - opp.defYPP - (opp.offYPP - team.defYPP))) / 1.5;
  p += 0.07 * (team.toDiffPg - opp.toDiffPg);
  p += 0.1 * (team.qbEff - opp.qbEff);

  if (isHome) p += BASE_HOME_EDGE;

  p = clamp01(p);

  const T = getTemperingFactor(week);
  const logit = Math.log(p / (1 - p));
  let tempered = 1 / (1 + Math.exp(-T * logit));

  // squash extremes
  tempered = 0.5 + 0.85 * (tempered - 0.5);

  return clamp01(tempered);
}

/**
 * ================= ODDS API =================
 */
async function fetchOdds() {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds?regions=${REGIONS}&markets=${MARKETS}&apiKey=${ODDS_API_KEY}`;
  const { data } = await axios.get(url, { timeout: 20000 });
  return data || [];
}

/**
 * ================= MAIN =================
 */
export async function run() {
  const [st25, st24, ts25, ts24] = await Promise.all([
    getStandings(`${CURRENT_SEASON}REG`).catch(() => []),
    getStandings(`${CURRENT_SEASON - 1}REG`).catch(() => []),
    getTeamSeasonStats(`${CURRENT_SEASON}REG`).catch(() => []),
    getTeamSeasonStats(`${CURRENT_SEASON - 1}REG`).catch(() => []),
  ]);

  const db25 = buildTeamDb(st25, ts25);
  const db24 = buildTeamDb(st24, ts24);

  const allNames = new Set([...Object.keys(db24), ...Object.keys(db25)]);
  const teams = {};
  for (const raw of allNames) {
    const name = normalizeTeam(raw);
    teams[name] = blendTeams(db25[name] || db25[raw], db24[name] || db24[raw]);
  }

  const games = await fetchOdds();
  const out = [];

  for (const g of games) {
    const dk = g.bookmakers?.find((b) => b.title === "DraftKings");
    if (!dk || !dk.markets?.length) continue;

    const home = normalizeTeam(g.home_team);
    const away = normalizeTeam(g.away_team);
    const week = getNFLWeek(g.commence_time);

    const tHome = teams[home];
    const tAway = teams[away];
    if (!tHome || !tAway) continue;

    // Compute base probs
    const baseHomeProb = modelNFLProb({
      team: tHome,
      opp: tAway,
      isHome: true,
      week,
    });
    const baseAwayProb = 1 - baseHomeProb;

    // Vegas probs
    const homeOutcome = dk.markets[0].outcomes.find(
      (o) => normalizeTeam(o.name) === home
    );
    const vegasHomeProb = homeOutcome
      ? impliedProbability(homeOutcome.price)
      : 0.5;

    // Blend 85% model + 15% vegas
    const homeProb = clamp01(0.85 * baseHomeProb + 0.15 * vegasHomeProb);
    const awayProb = 1 - homeProb;

    // Expected scores
    const totalBaseline =
      (tHome.pfpg + tAway.pfpg + tHome.papg + tAway.papg) / 2;
    let spreadPts = (homeProb - 0.5) * 24;
    spreadPts = Math.max(-20, Math.min(20, spreadPts));
    const adjSpread = spreadPts * 0.8;

    const homeExp = totalBaseline / 2 + adjSpread / 2;
    const awayExp = totalBaseline / 2 - adjSpread / 2;

    for (const outcome of dk.markets[0].outcomes || []) {
      const team = normalizeTeam(outcome.name);
      const isTeamHome = team === home;
      const prob = isTeamHome ? homeProb : awayProb;
      const teamExp = isTeamHome ? homeExp : awayExp;
      const oppExp = isTeamHome ? awayExp : homeExp;

      let odds = outcome.price;
      if (Math.abs(odds) < 10) odds = decimalToAmerican(parseFloat(odds));

      const dkImplied = impliedProbability(odds);
      const ev = calcEV(odds, prob, STAKE);

      out.push({
        game: `${home} vs ${away}`,
        team,
        opponent: isTeamHome ? away : home,
        isHome: isTeamHome,
        odds: odds > 0 ? `+${odds}` : `${odds}`,
        dkImpliedPct: +(dkImplied * 100).toFixed(2),
        myProbPct: +(prob * 100).toFixed(2),
        ev: +ev.toFixed(2),
        week,
        expectedScore: `${teamExp.toFixed(1)} - ${oppExp.toFixed(1)}`,
        predictedWinner: teamExp >= oppExp ? team : isTeamHome ? away : home,
      });
    }
  }

  return out.sort((a, b) => b.ev - a.ev);
}
