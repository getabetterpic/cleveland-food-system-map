import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  locations: defineTable({
    name: v.string(),
    category: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    address: v.string(),
    ward: v.any(),
    manager_name: v.string(),
    phone: v.string(),
    email: v.string(),
    notes: v.string(),
    image_url: v.string(),
    archived: v.string(),
  }),
});
