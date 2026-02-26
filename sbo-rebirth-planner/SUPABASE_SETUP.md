# Supabase Setup (SBO:Rebirth Build Planner)

Your Supabase project is ready for future cloud features (saved builds, shared builds DB).

## Project

- **URL:** `https://ejotaqqcqcoljzbbyesd.supabase.co`
- **Project ref:** `ejotaqqcqcoljzbbyesd`

## Local config

A `.env` file with your Supabase URL and anon key is already configured locally.  
Do not commit `.env` (it is in `.gitignore`).

## Wiki data sync

To store extracted wiki data in Supabase:

1. Run `supabase-schema.sql` in Supabase Dashboard → SQL Editor (creates `wiki_weapons`, `wiki_armor`, `wiki_shields`, `wiki_bosses`)
2. Run `node scripts/wiki-extract.js` then `node scripts/wiki-to-supabase.js`

## Future integration ideas

- Cloud-saved builds (user auth optional)
- Shared/public build gallery
- Planner mode to load catalog from Supabase
