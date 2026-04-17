import * as z from "zod/v4";

const statsShape = {
  hp: z.number().int().min(0).max(252).optional(),
  atk: z.number().int().min(0).max(252).optional(),
  def: z.number().int().min(0).max(252).optional(),
  spa: z.number().int().min(0).max(252).optional(),
  spd: z.number().int().min(0).max(252).optional(),
  spe: z.number().int().min(0).max(252).optional(),
};

export const StatsObjSchema = z.object(statsShape);

export const BoostsSchema = z.object({
  atk: z.number().int().min(-6).max(6).optional(),
  def: z.number().int().min(-6).max(6).optional(),
  spa: z.number().int().min(-6).max(6).optional(),
  spd: z.number().int().min(-6).max(6).optional(),
  spe: z.number().int().min(-6).max(6).optional(),
});

export const PokemonOptionalParamsSchema = z.object({
  abilityOn: z.boolean().optional(),
  gender: z.enum(["M", "F", "N"]).optional(),
  status: z.enum(["", "brn", "par", "psn", "tox", "slp", "frz"]).optional(),
  currentHp: z.number().int().min(0).optional(),
  alliesFainted: z.number().int().min(0).max(5).optional(),
  boostedStat: z.enum(["atk", "def", "spa", "spd", "spe", "auto"]).optional(),
  toxicCounter: z.number().int().min(0).optional(),
  moves: z.array(z.string()).max(4).optional(),
  forceStatsValue: z
    .object({
      hp: z.number().int().min(1).optional(),
      atk: z.number().int().min(1).optional(),
      def: z.number().int().min(1).optional(),
      spa: z.number().int().min(1).optional(),
      spd: z.number().int().min(1).optional(),
      spe: z.number().int().min(1).optional(),
    })
    .nullable()
    .optional(),
  teraType: z.string().optional(),
  isDynamaxed: z.boolean().optional(),
  dynamaxLevel: z.number().int().min(0).max(10).optional(),
});

export const PokemonInputSchema = z.object({
  name: z.string(),
  nature: z.string().optional(),
  ability: z.string().optional(),
  item: z.string().optional(),
  evs: StatsObjSchema.optional(),
  boosts: BoostsSchema.optional(),
  optionalParameterIgnoreUnlessNecessary:
    PokemonOptionalParamsSchema.optional(),
});

export const MoveOptionalParamsSchema = z.object({
  isCrit: z.boolean().optional(),
  hits: z.number().int().min(1).optional(),
  useZ: z.boolean().optional(),
  useMax: z.boolean().optional(),
  isStellarFirstUse: z.boolean().optional(),
  timesUsed: z.number().int().min(1).optional(),
  timesUsedWithMetronome: z.number().int().min(1).optional(),
});

export const MoveInputSchema = z.object({
  name: z.string(),
  optionalParameterIgnoreUnlessNecessary: MoveOptionalParamsSchema.optional(),
});

export const SideConditionsSchema = z.object({
  spikes: z.number().int().min(0).max(3).optional(),
  steelsurge: z.boolean().optional(),
  vinelash: z.boolean().optional(),
  wildfire: z.boolean().optional(),
  cannonade: z.boolean().optional(),
  volcalith: z.boolean().optional(),
  isSR: z.boolean().optional(),
  isReflect: z.boolean().optional(),
  isLightScreen: z.boolean().optional(),
  isAuroraVeil: z.boolean().optional(),
  isProtected: z.boolean().optional(),
  isSeeded: z.boolean().optional(),
  isSaltCured: z.boolean().optional(),
  isForesight: z.boolean().optional(),
  isTailwind: z.boolean().optional(),
  isHelpingHand: z.boolean().optional(),
  isFlowerGift: z.boolean().optional(),
  isPowerTrick: z.boolean().optional(),
  isFriendGuard: z.boolean().optional(),
  isBattery: z.boolean().optional(),
  isPowerSpot: z.boolean().optional(),
  isSteelySpirit: z.boolean().optional(),
  isSwitching: z.enum(["out", "in"]).optional(),
});

export const FieldInputSchema = z.object({
  weather: z
    .enum([
      "Sun",
      "Rain",
      "Sand",
      "Snow",
      "Hail",
      "HarshSun",
      "HeavyRain",
      "StrongWinds",
    ])
    .optional(),
  terrain: z.enum(["Electric", "Grassy", "Misty", "Psychic"]).optional(),
  isMagicRoom: z.boolean().optional(),
  isWonderRoom: z.boolean().optional(),
  isGravity: z.boolean().optional(),
  isAuraBreak: z.boolean().optional(),
  isFairyAura: z.boolean().optional(),
  isDarkAura: z.boolean().optional(),
  isBeadsOfRuin: z.boolean().optional(),
  isSwordOfRuin: z.boolean().optional(),
  isTabletsOfRuin: z.boolean().optional(),
  isVesselOfRuin: z.boolean().optional(),
  attackerSide: SideConditionsSchema.optional(),
  defenderSide: SideConditionsSchema.optional(),
});

export const CalcRequestSchema = z.object({
  format: z.enum(["Singles", "Doubles"]),
  gen: z.number().int().min(1).max(9).optional(),
  attacker: PokemonInputSchema,
  defender: PokemonInputSchema,
  move: MoveInputSchema,
  field: FieldInputSchema.optional(),
});

export type CalcRequest = z.infer<typeof CalcRequestSchema>;
export type PokemonInput = z.infer<typeof PokemonInputSchema>;
export type PokemonOptionalParams = z.infer<typeof PokemonOptionalParamsSchema>;
export type MoveInput = z.infer<typeof MoveInputSchema>;
export type MoveOptionalParams = z.infer<typeof MoveOptionalParamsSchema>;
export type FieldInput = z.infer<typeof FieldInputSchema>;
export type SideInput = z.infer<typeof SideConditionsSchema>;
