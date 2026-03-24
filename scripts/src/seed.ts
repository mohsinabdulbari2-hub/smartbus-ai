import { db } from "@workspace/db";
import {
  busRoutesTable,
  busStopsTable,
  routeStopsTable,
  busFrequencyTable,
} from "@workspace/db";

const stops = [
  { id: "majestic", name: "Majestic (KBS)", lat: 12.9766, lng: 77.5714 },
  { id: "shivajinagar", name: "Shivajinagar", lat: 12.9850, lng: 77.5980 },
  { id: "mekhri-circle", name: "Mekhri Circle", lat: 13.0028, lng: 77.5744 },
  { id: "hebbal", name: "Hebbal", lat: 13.0351, lng: 77.5940 },
  { id: "airport-road", name: "Airport Road", lat: 13.0500, lng: 77.6100 },
  { id: "yelahanka", name: "Yelahanka", lat: 13.1010, lng: 77.5963 },
  { id: "silk-board", name: "Silk Board", lat: 12.9170, lng: 77.6233 },
  { id: "koramangala", name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { id: "hsr-layout", name: "HSR Layout", lat: 12.9116, lng: 77.6474 },
  { id: "electronic-city", name: "Electronic City", lat: 12.8399, lng: 77.6770 },
  { id: "btm-layout", name: "BTM Layout", lat: 12.9165, lng: 77.6101 },
  { id: "jayanagar", name: "Jayanagar", lat: 12.9308, lng: 77.5836 },
  { id: "basavanagudi", name: "Basavanagudi", lat: 12.9428, lng: 77.5742 },
  { id: "ulsoor", name: "Ulsoor", lat: 12.9818, lng: 77.6185 },
  { id: "mg-road", name: "MG Road", lat: 12.9756, lng: 77.6093 },
  { id: "whitefield", name: "Whitefield", lat: 12.9698, lng: 77.7500 },
  { id: "marathahalli", name: "Marathahalli", lat: 12.9591, lng: 77.6974 },
  { id: "kr-puram", name: "KR Puram", lat: 13.0055, lng: 77.6960 },
  { id: "old-airport-road", name: "Old Airport Road", lat: 12.9796, lng: 77.6493 },
  { id: "indiranagar", name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { id: "rajajinagar", name: "Rajajinagar", lat: 12.9910, lng: 77.5530 },
  { id: "yeshwanthpur", name: "Yeshwanthpur", lat: 13.0230, lng: 77.5360 },
  { id: "malleshwaram", name: "Malleshwaram", lat: 13.0010, lng: 77.5630 },
  { id: "vijayanagar", name: "Vijayanagar", lat: 12.9720, lng: 77.5350 },
  { id: "kengeri", name: "Kengeri", lat: 12.9124, lng: 77.4820 },
  { id: "banashankari", name: "Banashankari", lat: 12.9260, lng: 77.5470 },
  { id: "jp-nagar", name: "JP Nagar", lat: 12.9062, lng: 77.5826 },
  { id: "bommanahalli", name: "Bommanahalli", lat: 12.8973, lng: 77.6222 },
  { id: "marthahalli-ring", name: "Outer Ring Road", lat: 12.9560, lng: 77.7100 },
  { id: "tin-factory", name: "Tin Factory", lat: 13.0043, lng: 77.6691 },
];

const routes = [
  {
    id: "500d",
    name: "Majestic - Yelahanka via Hebbal",
    number: "500D",
    from: "Majestic",
    to: "Yelahanka",
    color: "#EF4444",
    lastBusTime: "22:30",
    stops: ["majestic", "malleshwaram", "mekhri-circle", "hebbal", "airport-road", "yelahanka"],
  },
  {
    id: "356f",
    name: "Silk Board - Whitefield Express",
    number: "356F",
    from: "Silk Board",
    to: "Whitefield",
    color: "#3B82F6",
    lastBusTime: "23:00",
    stops: ["silk-board", "koramangala", "indiranagar", "old-airport-road", "marathahalli", "whitefield"],
  },
  {
    id: "201r",
    name: "Majestic - Electronic City",
    number: "201R",
    from: "Majestic",
    to: "Electronic City",
    color: "#10B981",
    lastBusTime: "22:00",
    stops: ["majestic", "jayanagar", "basavanagudi", "btm-layout", "bommanahalli", "electronic-city"],
  },
  {
    id: "401",
    name: "KR Puram - Majestic",
    number: "401",
    from: "KR Puram",
    to: "Majestic",
    color: "#F59E0B",
    lastBusTime: "21:45",
    stops: ["kr-puram", "tin-factory", "old-airport-road", "ulsoor", "mg-road", "shivajinagar", "majestic"],
  },
  {
    id: "313c",
    name: "Vijayanagar - Whitefield",
    number: "313C",
    from: "Vijayanagar",
    to: "Whitefield",
    color: "#8B5CF6",
    lastBusTime: "22:15",
    stops: ["vijayanagar", "rajajinagar", "majestic", "mg-road", "indiranagar", "marathahalli", "marthahalli-ring", "whitefield"],
  },
  {
    id: "kia-9",
    name: "Majestic - Airport (KIAS)",
    number: "KIA-9",
    from: "Majestic",
    to: "Yelahanka",
    color: "#EC4899",
    lastBusTime: "23:59",
    stops: ["majestic", "yeshwanthpur", "mekhri-circle", "hebbal", "airport-road", "yelahanka"],
  },
  {
    id: "252",
    name: "JP Nagar - Shivajinagar",
    number: "252",
    from: "JP Nagar",
    to: "Shivajinagar",
    color: "#06B6D4",
    lastBusTime: "21:30",
    stops: ["jp-nagar", "banashankari", "basavanagudi", "jayanagar", "btm-layout", "silk-board", "koramangala", "mg-road", "shivajinagar"],
  },
  {
    id: "600k",
    name: "Kengeri - Electronic City",
    number: "600K",
    from: "Kengeri",
    to: "Electronic City",
    color: "#84CC16",
    lastBusTime: "22:00",
    stops: ["kengeri", "vijayanagar", "banashankari", "jp-nagar", "btm-layout", "hsr-layout", "bommanahalli", "electronic-city"],
  },
];

const frequencies: Record<string, { weekday: [number, number, number, number]; weekend: [number, number, number, number] }> = {
  "500d": { weekday: [8, 4, 6, 2], weekend: [5, 3, 4, 1] },
  "356f": { weekday: [6, 3, 7, 2], weekend: [4, 2, 4, 1] },
  "201r": { weekday: [5, 4, 6, 2], weekend: [3, 3, 4, 1] },
  "401":  { weekday: [7, 5, 8, 3], weekend: [5, 4, 5, 2] },
  "313c": { weekday: [4, 3, 5, 2], weekend: [3, 2, 3, 1] },
  "kia-9":{ weekday: [6, 6, 6, 4], weekend: [6, 5, 6, 4] },
  "252":  { weekday: [5, 3, 6, 2], weekend: [4, 3, 4, 1] },
  "600k": { weekday: [4, 3, 5, 2], weekend: [3, 2, 3, 1] },
};

async function seed() {
  console.log("Seeding database...");

  await db.delete(busFrequencyTable);
  await db.delete(routeStopsTable);
  await db.delete(busStopsTable);
  await db.delete(busRoutesTable);

  console.log("Inserting stops...");
  for (const stop of stops) {
    await db.insert(busStopsTable).values({
      id: stop.id,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
    }).onConflictDoNothing();
  }

  console.log("Inserting routes...");
  for (const route of routes) {
    await db.insert(busRoutesTable).values({
      id: route.id,
      name: route.name,
      number: route.number,
      from: route.from,
      to: route.to,
      color: route.color,
      totalStops: route.stops.length,
      lastBusTime: route.lastBusTime,
    }).onConflictDoNothing();

    for (let i = 0; i < route.stops.length; i++) {
      await db.insert(routeStopsTable).values({
        routeId: route.id,
        stopId: route.stops[i],
        order: i,
      }).onConflictDoNothing();
    }
  }

  console.log("Inserting frequency data...");
  for (const [routeId, freq] of Object.entries(frequencies)) {
    await db.insert(busFrequencyTable).values({
      routeId,
      dayType: "weekday",
      morning: freq.weekday[0],
      afternoon: freq.weekday[1],
      evening: freq.weekday[2],
      night: freq.weekday[3],
    }).onConflictDoNothing();

    await db.insert(busFrequencyTable).values({
      routeId,
      dayType: "weekend",
      morning: freq.weekend[0],
      afternoon: freq.weekend[1],
      evening: freq.weekend[2],
      night: freq.weekend[3],
    }).onConflictDoNothing();
  }

  console.log("Seed complete!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
