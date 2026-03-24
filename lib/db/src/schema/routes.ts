import { pgTable, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const busRoutesTable = pgTable("bus_routes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  from: text("from_stop").notNull(),
  to: text("to_stop").notNull(),
  color: text("color").notNull().default("#3B82F6"),
  totalStops: integer("total_stops").notNull().default(0),
  lastBusTime: text("last_bus_time"),
});

export const busStopsTable = pgTable("bus_stops", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
});

export const routeStopsTable = pgTable("route_stops", {
  routeId: text("route_id").notNull().references(() => busRoutesTable.id),
  stopId: text("stop_id").notNull().references(() => busStopsTable.id),
  order: integer("order").notNull(),
});

export const busFrequencyTable = pgTable("bus_frequency", {
  routeId: text("route_id").notNull().references(() => busRoutesTable.id),
  dayType: text("day_type").notNull(),
  morning: real("morning").notNull(),
  afternoon: real("afternoon").notNull(),
  evening: real("evening").notNull(),
  night: real("night").notNull(),
});

export const insertRouteSchema = createInsertSchema(busRoutesTable);
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type BusRoute = typeof busRoutesTable.$inferSelect;
export type BusStop = typeof busStopsTable.$inferSelect;
