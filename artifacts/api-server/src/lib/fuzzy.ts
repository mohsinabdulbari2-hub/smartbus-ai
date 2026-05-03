export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

const ABBREV: Record<string, string> = {
  rd: "road",
  st: "street",
  jn: "junction",
  jct: "junction",
  nr: "near",
  cir: "circle",
  blr: "bangalore",
  bglr: "bangalore",
  bnglr: "bangalore",
  bengaluru: "bangalore",
  ngr: "nagar",
  layout: "layout",
  lyt: "layout",
  mkt: "market",
  hsp: "hospital",
  stn: "station",
  bs: "bus stop",
  bts: "bus stop",
};

function expand(token: string): string {
  return ABBREV[token] !== undefined ? ABBREV[token] : token;
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .map(expand)
    .flatMap((t) => t.split(" "))
    .filter((t) => t.length > 0);
}

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function tokenMatch(qTok: string, nTok: string): boolean {
  if (qTok === nTok) return true;
  if (qTok.length >= 4 && nTok.startsWith(qTok)) return true;
  if (nTok.length >= 4 && qTok.startsWith(nTok)) return true;
  if (qTok.length >= 4 && nTok.includes(qTok)) return true;
  const maxLen = Math.max(qTok.length, nTok.length);
  if (maxLen < 4) return false;
  const allowed = maxLen <= 5 ? 1 : maxLen <= 8 ? 2 : 3;
  return levenshtein(qTok, nTok, allowed) <= allowed;
}

export interface FuzzyScore {
  matched: boolean;
  score: number;
}

export function fuzzyScoreTokens(
  qTokens: string[],
  qLower: string,
  nTokens: string[],
  nLower: string
): FuzzyScore {
  if (qTokens.length === 0 || nTokens.length === 0) return { matched: false, score: 0 };

  if (nLower === qLower) return { matched: true, score: 100 };
  if (nLower.includes(qLower)) return { matched: true, score: 90 };
  if (qLower.includes(nLower)) return { matched: true, score: 80 };

  let matched = 0;
  for (const qt of qTokens) {
    if (nTokens.some((nt) => tokenMatch(qt, nt))) matched++;
  }
  const ratio = matched / qTokens.length;
  if (ratio >= 0.6) {
    return { matched: true, score: Math.round(40 + ratio * 40) };
  }
  return { matched: false, score: 0 };
}

export function fuzzyScore(query: string, name: string): FuzzyScore {
  return fuzzyScoreTokens(
    tokenize(query),
    normalize(query),
    tokenize(name),
    normalize(name)
  );
}

