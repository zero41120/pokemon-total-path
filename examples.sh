#!/usr/bin/env bash
# Damage calculation examples for POST /calc
#
# Response shape:
# {
#   "description": "...",
#   "attackerStats": "167/130/95/252+/95/183 (0/0/0/252+/0/252)",   <- stat values / ev spread, + = nature boost, - = nature drop
#   "defenderStats": "167/130/95/252+/95/183 (0/0/0/252+/0/252)",
#   "range": [min, max],
#   "percent": [minPct, maxPct],
#   "ko": { "chance": 1.0, "n": 1, "text": "guaranteed OHKO" }
# }
# Stats parenthetical ALWAYS shows Champion points (0-32).
# If evs > 32 are passed (legacy), they are converted internally (÷8) for display.

# Standard gen 9 example: Miraidon vs Calyrex-Shadow, Doubles
curl -s -X POST http://localhost:3000/calc \
  -H "Content-Type: application/json" \
  -d '{
    "gen": 9,
    "format": "Doubles",
    "attacker": {
      "name": "Miraidon",
      "ability": "Hadron Engine",
      "item": "Choice Specs",
      "nature": "Timid",
      "evs": { "spa": 252, "spe": 252, "hp": 4 }
    },
    "defender": {
      "name": "Calyrex-Shadow",
      "ability": "As One (Spectrier)",
      "item": "Focus Sash",
      "nature": "Timid",
      "evs": { "spa": 252, "spe": 252, "hp": 4 }
    },
    "move": { "name": "Electro Drift" },
    "field": {
      "terrain": "Electric"
    }
  }'
# Expected output:
# {
#   "description": "252 SpA Choice Specs Hadron Engine Miraidon Electro Drift vs. 4 HP / 0 SpD Calyrex-Shadow in Electric Terrain",
#   "attackerStats": "155/94-/100/200/100/184+ (0/0-/0/32/0/32+)",
#   "defenderStats": "156/100-/80/200/135/184+ (0/0-/0/32/0/32+)",
#   "range": [174, 206],
#   "percent": [166.3, 197.1],
#   "ko": { "chance": 1.0, "n": 1, "text": "guaranteed OHKO (Focus Sash will activate)" }
# }

# Champions mode example: evs with values 0-32 are auto-detected as Champions stat points
# and converted internally (×8, IVs fixed at 31). AI just uses "evs" — no separate field needed.
curl -s -X POST http://localhost:3000/calc \
  -H "Content-Type: application/json" \
  -d '{
    "gen": 9,
    "format": "Doubles",
    "attacker": {
      "name": "Garchomp",
      "ability": "Rough Skin",
      "item": "Life Orb",
      "nature": "Jolly",
      "evs": { "atk": 32, "spe": 20, "hp": 14 }
    },
    "defender": {
      "name": "Amoonguss",
      "ability": "Regenerator",
      "item": "Rocky Helmet",
      "nature": "Sassy",
      "evs": { "hp": 32, "spd": 32, "def": 2 }
    },
    "move": { "name": "Earthquake" },
    "field": {
      
    }
  }'
# Expected output (Champions mode — parenthetical shows stat points 0-32):
# {
#   "description": "32 Atk pts Life Orb Jolly Garchomp Earthquake vs. 32 HP / 2 Def pts Sassy Amoonguss",
#   "attackerStats": "155/193+/115/80/85-/169 (14/32+/0/0/0/20)",
#   "defenderStats": "236/100/90-/90/117+/55 (32/0/2/0/32+/0)",
#   "range": [88, 105],
#   "percent": [42.1, 50.2],
#   "ko": { "chance": 0.0, "n": 2, "text": "50% chance to 2HKO after Rocky Helmet recoil" }
# }

# forceStatsValue example: Shuckle used Power Trick — Atk and Def are physically swapped.
# forceStatsValue sets exact final stat values, bypassing evs/ivs/nature for those stats.
# Useful for Power Trick, Psych Up copies, or any scenario where the true stat is known.
curl -s -X POST http://localhost:3000/calc \
  -H "Content-Type: application/json" \
  -d '{
    "gen": 9,
    "format": "Doubles",
    "attacker": {
      "name": "Shuckle",
      "ability": "Contrary",
      "item": "Chesto Berry",
      "nature": "Brave",
      "evs": { "def": 32 },
      "ignoreableOptionalParameter": {
        "forceStatsValue": { "atk": 230, "def": 15 }
      }
    },
    "defender": {
      "name": "Calyrex-Ice",
      "ability": "As One (Glastrier)",
      "item": "Weakness Policy",
      "nature": "Adamant",
      "evs": { "hp": 32, "def": 32 }
    },
    "move": { "name": "Rock Smash" },
    "field": {
    }
  }'
# Expected output (forceStatsValue overrides atk/def; parenthetical shows "-" for forced stats):
# {
#   "description": "230 Atk Shuckle Rock Smash vs. 32 HP / 32 Def pts Calyrex-Ice",
#   "attackerStats": "35/230!/15!/65/130/10- (0/0/32/0/0/0-)",
#   "defenderStats": "204/165+/115/85/130/50 (32/0/32/0/0/0)",
#   "range": [52, 64],
#   "percent": [25.5, 31.4],
#   "ko": { "chance": 0.0, "n": 4, "text": "not a KO" }
# }
# Note: "!" marks a stat overridden by forceStatsValue so the reader knows it was forced.

# Exhaustive example — every supported field present.
# Scenario: +2 Helping Hand Gholdengo Make It Rain vs Salt Cured Incineroar behind Reflect.
curl -s -X POST http://localhost:3000/calc \
  -H "Content-Type: application/json" \
  -d '{
    "gen": 9,
    "format": "Doubles",
    "attacker": {
      "name": "Gholdengo",
      "nature": "Modest",
      "ability": "Good as Gold",
      "item": "Choice Specs",
      "evs": { "hp": 4, "atk": 0, "def": 0, "spa": 32, "spd": 0, "spe": 28 },
      "boosts": { "atk": 0, "def": 0, "spa": 2, "spd": 0, "spe": 0 },
      "ignoreableOptionalParameter": {
        "abilityOn": true,
        "gender": "M",
        "status": "par",
        "currentHp": 145,
        "alliesFainted": 0,
        "boostedStat": "auto",
        "toxicCounter": 0,
        "moves": ["Make It Rain", "Shadow Ball", "Nasty Plot", "Protect"],
        "teraType": "Steel",
        "isDynamaxed": false,
        "dynamaxLevel": 10,
        "forceStatsValue": null
      }
    },
    "defender": {
      "name": "Incineroar",
      "nature": "Careful",
      "ability": "Intimidate",
      "item": "Assault Vest",
      "evs": { "hp": 32, "atk": 4, "def": 0, "spa": 0, "spd": 32, "spe": 0 },
      "boosts": { "atk": -1, "def": 0, "spa": 0, "spd": 0, "spe": 0 },
      "ignoreableOptionalParameter": {
        "abilityOn": true,
        "gender": "M",
        "status": "",
        "currentHp": 150,
        "alliesFainted": 0,
        "boostedStat": "auto",
        "toxicCounter": 0,
        "moves": ["Fake Out", "Parting Shot", "Flare Blitz", "Knock Off"],
        "teraType": "Fire",
        "isDynamaxed": false,
        "dynamaxLevel": 10,
        "forceStatsValue": null
      }
    },
    "move": {
      "name": "Make It Rain",
      "ignoreableOptionalParameter": {
        "isCrit": false,
        "useZ": false,
        "useMax": false,
        "isStellarFirstUse": false,
        "hits": 1,
        "timesUsed": 1,
        "timesUsedWithMetronome": 1
      }
    },
    "field": {
      "weather": "Sun",
      "terrain": "Electric",
      "isMagicRoom": false,
      "isWonderRoom": false,
      "isGravity": false,
      "isAuraBreak": false,
      "isFairyAura": false,
      "isDarkAura": false,
      "isBeadsOfRuin": false,
      "isSwordOfRuin": false,
      "isTabletsOfRuin": false,
      "isVesselOfRuin": false,
      "attackerSide": {
        "spikes": 0,
        "steelsurge": false,
        "vinelash": false,
        "wildfire": false,
        "cannonade": false,
        "volcalith": false,
        "isSR": false,
        "isReflect": false,
        "isLightScreen": false,
        "isAuroraVeil": false,
        "isProtected": false,
        "isSeeded": false,
        "isSaltCured": false,
        "isForesight": false,
        "isTailwind": true,
        "isHelpingHand": true,
        "isFlowerGift": false,
        "isPowerTrick": false,
        "isFriendGuard": false,
        "isBattery": false,
        "isPowerSpot": false,
        "isSteelySpirit": false,
        "isSwitching": "out"
      },
      "defenderSide": {
        "spikes": 1,
        "steelsurge": false,
        "vinelash": false,
        "wildfire": false,
        "cannonade": false,
        "volcalith": false,
        "isSR": true,
        "isReflect": true,
        "isLightScreen": false,
        "isAuroraVeil": false,
        "isProtected": false,
        "isSeeded": false,
        "isSaltCured": true,
        "isForesight": false,
        "isTailwind": false,
        "isHelpingHand": false,
        "isFlowerGift": false,
        "isPowerTrick": false,
        "isFriendGuard": true,
        "isBattery": false,
        "isPowerSpot": false,
        "isSteelySpirit": false,
        "isSwitching": "in"
      }
    }
  }'
# Expected output:
# {
#   "description": "+2 252 SpA Choice Specs Gholdengo Make It Rain vs. 32 HP / 32 SpD+ Assault Vest Incineroar (Helping Hand, Friend Guard, Reflect, Salt Cure)",
#   "attackerStats": "152/76-/96/194+/96/148 (4/0-/0/32+/0/28)",
#   "defenderStats": "204/141/90/65/136+/81- (32/4/0/0/32+/0-)",
#   "range": [96, 114],
#   "percent": [47.1, 55.9],
#   "ko": { "chance": 0.0, "n": 2, "text": "87.5% chance to 2HKO" }
# }

# Crit + attacker side boost example
curl -s -X POST http://localhost:3000/calc \
  -H "Content-Type: application/json" \
  -d '{
    "gen": 9,
    "format": "Doubles",
    "attacker": {
      "name": "Flutter Mane",
      "ability": "Protosynthesis",
      "item": "Booster Energy",
      "nature": "Timid",
      "evs": { "spa": 252, "spe": 4, "hp": 252 },
      "boosts": { "spa": 2 }
    },
    "defender": {
      "name": "Incineroar",
      "ability": "Intimidate",
      "item": "Assault Vest",
      "nature": "Careful",
      "evs": { "hp": 252, "spd": 252, "atk": 4 }
    },
    "move": { "name": "Moonblast", "ignoreableOptionalParameter": { "isCrit": false } },
    "field": {
      "attackerSide": { "isHelpingHand": true }
    }
  }'
# Expected output:
# {
#   "description": "+2 252 SpA Protosynthesis Flutter Mane Moonblast vs. 252 HP / 252+ SpD Assault Vest Incineroar (Helping Hand)",
#   "attackerStats": "192/65-/100/200/135/184+ (32/0-/0/32/0/0+)",
#   "defenderStats": "197/141/90/90-/136+/81 (32/0/0/0-/32+/0)",
#   "range": [207, 244],
#   "percent": [119.7, 141.0],
#   "ko": { "chance": 1.0, "n": 1, "text": "guaranteed OHKO" }
# }
