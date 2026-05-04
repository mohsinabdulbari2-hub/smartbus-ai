// Lightweight client-side fuzzy matcher for stop / route names.
// Mirrors (a subset of) the server's fuzzy.ts so the UI can do
// typo-tolerant filtering without an API call.

const ABBREV: Record<string, string> = {
  rd: "road",
  st: "street",
  jn: "junction",
  jct: "junction",
  cir: "circle",
  blr: "bangalore",
  bglr: "bangalore",
  bengaluru: "bangalore",
  ngr: "nagar",
  lyt: "layout",
  mkt: "market",
  hsp: "hospital",
  stn: "station",
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .map((t) => ABBREV[t] ?? t)
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
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
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

// Returns true if `query` matches `target` allowing typos.
// - Empty query → match all.
// - For each query token: matches if it is a substring OR within
//   Levenshtein 1 (short tokens) / 2 (longer tokens) of any target token.
// Set `allTokens` to require every query token to match (AND).
export function fuzzyMatch(query: string, target: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const lowerTarget = normalize(target);
  if (lowerTarget.includes(q)) return true; // fast path: substring match

  const qTokens = tokenize(query);
  const tTokens = tokenize(target);
  if (qTokens.length === 0) return true;

  for (const qt of qTokens) {
    let ok = false;
    // Only short tokens (>=3 chars) get edit-distance tolerance.
    // 1- and 2-char tokens are too ambiguous to fuzzy-match safely.
    const allowFuzzy = qt.length >= 3;
    const maxDist = qt.length <= 5 ? 1 : 2;
    for (const tt of tTokens) {
      // Substring: query is contained in a target token (e.g. "indr" → "indiranagar").
      // Symmetric (target ⊂ query) only when both are reasonably long, to avoid
      // garbage like "bs" ⊂ "bus" matching every street with "bus" in it.
      if (tt.includes(qt)) { ok = true; break; }
      if (qt.length >= 4 && tt.length >= 3 && qt.includes(tt)) { ok = true; break; }
      if (allowFuzzy && Math.abs(qt.length - tt.length) <= maxDist
          && levenshtein(qt, tt, maxDist) <= maxDist) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

// Score a candidate against the query (higher = better). Used to rank
// suggestions in empty states. 0 means no fuzzy hit.
export function fuzzyScore(query: string, target: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const t = normalize(target);
  if (t === q) return 100;
  if (t.includes(q)) return 80 - Math.min(20, t.length - q.length);

  const qTokens = tokenize(query);
  const tTokens = tokenize(target);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let total = 0;
  let matched = 0;
  for (const qt of qTokens) {
    let best = 0;
    const allowFuzzy = qt.length >= 3;
    const maxDist = qt.length <= 5 ? 1 : 2;
    for (const tt of tTokens) {
      if (tt === qt) { best = Math.max(best, 50); continue; }
      if (qt.length >= 3 && tt.startsWith(qt)) { best = Math.max(best, 35); continue; }
      if (qt.length >= 4 && qt.startsWith(tt) && tt.length >= 3) { best = Math.max(best, 30); continue; }
      if (qt.length >= 3 && tt.includes(qt)) { best = Math.max(best, 25); continue; }
      if (allowFuzzy && Math.abs(qt.length - tt.length) <= maxDist) {
        const d = levenshtein(qt, tt, maxDist);
        if (d <= maxDist) best = Math.max(best, 20 - d * 5);
      }
    }
    if (best > 0) matched++;
    total += best;
  }
  if (matched === 0) return 0;
  // bonus for matching all tokens
  return total + (matched === qTokens.length ? 15 : 0);
}
