# Wiki vs Catalog Diff — 2026-02-26

Compare `data/wiki-raw/*.json` with `data.js` and `boss-data.js`.

---

## Weapons
- **NEW:** 274 | **CHANGED:** 23 | **IN_CATALOG_ONLY:** 59

### NEW (in wiki, not in catalog)
| Name | Attack | Skill | Col | weaponType |
|------|--------|-------|-----|------------|
| Blackened Riposte | 955 | 225 | 65191 | Rapier |
| Atlantic Enguarde | 677 | 175 | 50692 | Rapier |
| Apocalyptic Bringer | 628 | 175 | 50692 | Dagger |
| Blessed Lance | 294 | 95 | 100 | Rapier |
| Blessed Lance MII | 785 | 195 | 240 | Rapier |
| Blessed Lance MIII | 1579 | 325 | 320 | Rapier |
| Ascending Blade | 4 | 1 | 0 | One Handed |
| Bane Wand | 99 | 45 | 250 | Dagger |
| Bane Wand Mk II | 354 | 115 | 300 | Dagger |
| Bell Scythe | 4 | 1 | 300 | Two Handed |
| Anguish Carver | 1032 | 220 | 63799 | Legendary Dagger |
| Blessed Blade | 1330 | 260 | 75400 | One Handed |
| Blessed Dagger | 1080 | 260 | 75400 | Dagger |
| Blessed Rapier | 1164 | 260 | 75400 | Rapier |
| Blessed Greatsword | 1662 | 260 | 75400 | Two Handed |
| Akikos Will | 1295 | 255 | 73892 | One Handed |
| Blue Rose Sword | 4 | 1 | 0 | One Handed |
| Barbthorn Needle | - | - | - | Rapier |
| Barbthorn Needle MK II | - | - | - | Rapier |
| Barbthorn Needle MK III | - | - | - | Rapier |
| Barbthorn Needle MK IV | - | - | - | Rapier |
| Barbthorn Needle MK V | - | - | - | Rapier |
| Bloodborne Dominion | - | - | - | Two Handed |
| Bloodborne Dominion MK II | - | - | - | Two Handed |
| Bloodborne Dominion MK III | - | - | - | Two Handed |
| Bloodborne Dominion MK IV | - | - | - | Two Handed |
| Bloodborne Dominion MK V | - | - | - | Two Handed |
| Corroded Piercer | 573 | 155 | 44892 | Rapier |
| Coladas Black Blade | 757 | 190 | 55099 | Rapier |
| Candy Cane Rapier | 6 | 1 | 300 | Rapier |
| ... and 244 more |

### CHANGED (stats differ)
| Name | Field | Catalog | Wiki |
|------|-------|---------|------|
| Atlantic Destroyer | colValue | 51800 | 50692 |
| Butterfly Katana | attack | 614 | 743 |
| Butterfly Katana | colValue | 49200 | 49300 |
| Beginner Sword | attack | 3.4 | 4 |
| Crimson Shadow | colValue | 54900 | 53591 |
| Dark Repulser Mk III | colValue | 56500 | 55099 |
| Doomed Treasure | colValue | 56500 | 55099 |
| Forest Warrior | colValue | 58100 | 57999 |
| Forest Buster | colValue | 58100 | 57999 |
| Iron Sword | attack | 3.4 | 4 |
| Kamikaze Katana | colValue | 49200 | 49300 |
| Iron Rapier | attack | 2.6 | 6 |
| Iron Dagger | attack | 2.5 | 5 |
| Noble Rapier | attack | 15.6 | 6 |
| Malachite Rapier | attack | 139 | 90 |
| Master Steel Dagger | attack | 14.5 | 5 |
| Poseidons Repulser | colValue | 51800 | 50692 |
| Permafrost Rapier | attack | 294 | 232 |
| Steel Sword | attack | 8.4 | 4 |
| Steel Rapier | attack | 7.6 | 6 |
| Steel Dagger | attack | 7.5 | 5 |
| ... and 3 more |

## Armor
- **NEW:** 117 | **CHANGED:** 13 | **IN_CATALOG_ONLY:** 0

### NEW (sample)
| Name | Level | Defense | Dexterity |
|------|-------|---------|-----------|
| Auroras Cloak | 46 | 41.5 | 233 |
| Blessed Pendant of Light | 95 | 30 | - |
| Bloodsuckers Cloak | 50 | - | 87 |
| Easter Egg Bobbers | 180 | - | 496 |
| Easter Pendant | 170 | - | 459 |
| Elf Outfit | 1 | 1 | 5 |
| Coned Helmet | 14 | - | 16 |
| Bucket Helmet | 22 | - | 29 |
| Desert Helmet | 35 | - | 54 |
| Ancient Helmet | 45 | - | 76 |
| Crusader Helmet | 95 | - | 209 |
| Crown | 100 | - | 224 |
| Beginners Cloak | 6 | - | 5 |
| Desert Pancho | 30 | - | 44 |
| Cloak of Ice | 40 | - | 65 |

## Shields
- **NEW:** 31 | **CHANGED:** 13 | **IN_CATALOG_ONLY:** 1

## Bosses
- **NEW:** 22 | **CHANGED:** 9 | **IN_CATALOG_ONLY:** 1

### CHANGED (sample)
| Name | Field | Catalog | Wiki |
|------|-------|---------|------|
| Storm Atronach | hp | 144000 | 144 |
| Grimlock the Fallen King | recLevel | 100 | 1 |
| Laurellis the Purgatory Flax | recLevel | 110 | 1 |
| Slime Lord Pengonis | recLevel | 110 | 1 |
| The Tormented Soul | recLevel | 120 | 1 |
| Young Celestia | recLevel | 135 | 1 |
| Captain Sweet the Forever Child | recLevel | 168 | 1 |
| Eidolon the Gilded Omen | recLevel | 190 | 1 |
| The Frontman | recLevel | 200 | 2 |

---

**Workflow:** Run `node scripts/wiki-extract.js` then `node scripts/wiki-diff.js`. Review this report and manually update `data.js` / `boss-data.js` as needed.