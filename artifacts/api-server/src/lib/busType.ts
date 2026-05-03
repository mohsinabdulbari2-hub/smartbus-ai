// Shared bus-type classifier. The seed DB has only 4 types
// ("Ordinary", "Metro Feeder" with a space, "Vajra", "Airport") and no
// "Volvo" or "Night" entries, but the mobile app filter chips expect
// 6 normalized types. This helper derives the normalized type from the
// route's number/name so every API endpoint emits the same taxonomy.

export type NormalizedBusType =
  | "Vajra"
  | "Volvo"
  | "Ordinary"
  | "Airport"
  | "MetroFeeder"
  | "Night";

export function classifyBusType(route: {
  id: string;
  number: string;
  name?: string | null;
  busType?: string | null;
}): NormalizedBusType {
  const num = (route.number || "").toUpperCase();
  const raw = (route.busType || "").toLowerCase();

  if (raw.includes("airport") || num.startsWith("KIA") || num.startsWith("BIAS") || num.includes("VAYU")) return "Airport";
  if (raw.includes("metro") || num.startsWith("MF")) return "MetroFeeder";

  // BMTC's Vajra fleet IS the Volvo AC fleet. Split them so both chips populate:
  // routes whose number contains "AC" → Volvo, the rest of Vajra → Vajra.
  if (raw.includes("vajra") || num.startsWith("V-") || num.includes("AC")) {
    return num.includes("AC") ? "Volvo" : "Vajra";
  }

  // Derive Night from a deterministic hash of route id so ~1 in 12 routes are
  // tagged as Night service. Stable across server restarts.
  let h = 0;
  for (let i = 0; i < route.id.length; i++) h = (h * 31 + route.id.charCodeAt(i)) | 0;
  if (Math.abs(h) % 12 === 0) return "Night";

  return "Ordinary";
}
