import type { FoodId } from "./types.js";

export interface FoodDefinition {
  id: FoodId;
  label: string;
  glyph: string;
  color: string;
  description: string;
}

export const FOODS: readonly FoodDefinition[] = [
  {
    id: "spinach",
    label: "Spinach",
    glyph: "S",
    color: "#55a84f",
    description: "Stronger throws; a bigger wind-up telegraphs the hit.",
  },
  {
    id: "potato",
    label: "Potato",
    glyph: "P",
    color: "#b98b55",
    description: "+1 heart and mass per stack; slower and larger.",
  },
  {
    id: "banana",
    label: "Banana",
    glyph: "B",
    color: "#f2cd45",
    description: "Faster acceleration with wider turns.",
  },
  {
    id: "carrot",
    label: "Carrot",
    glyph: "C",
    color: "#ee8135",
    description: "Gentle server-validated aim assistance.",
  },
  {
    id: "blueberries",
    label: "Blueberries",
    glyph: "Bb",
    color: "#5365b5",
    description: "Less knockback and faster recovery.",
  },
  {
    id: "watermelon",
    label: "Watermelon",
    glyph: "W",
    color: "#59ad69",
    description: "Higher jumps with longer landing recovery.",
  },
  {
    id: "oatmeal",
    label: "Oatmeal",
    glyph: "O",
    color: "#d2b785",
    description: "Shorter grappling-hook cooldown.",
  },
  {
    id: "peas",
    label: "Peas",
    glyph: "Pe",
    color: "#73bd50",
    description: "Sharper lateral movement; easier to knock back.",
  },
  {
    id: "applesauce",
    label: "Applesauce",
    glyph: "A",
    color: "#cf6449",
    description: "Better air steering; stronger pulls affect you.",
  },
] as const;

export const FOOD_IDS = FOODS.map(({ id }) => id);

export function stackCount(foods: readonly FoodId[], id: FoodId): number {
  return foods.filter((food) => food === id).length;
}

export function foodModifiers(foods: readonly FoodId[]) {
  const spinach = stackCount(foods, "spinach");
  const potato = stackCount(foods, "potato");
  const banana = stackCount(foods, "banana");
  const watermelon = stackCount(foods, "watermelon");
  const oatmeal = stackCount(foods, "oatmeal");
  const peas = stackCount(foods, "peas");
  const applesauce = stackCount(foods, "applesauce");
  return {
    throwMultiplier: [1, 1.55, 2.2, 3][spinach] ?? 3,
    maxHeartsBonus: potato,
    scale: 1 + potato * 0.1,
    mass: (1 + potato * 0.3) * (1 - applesauce * 0.08),
    speedMultiplier: (1 - potato * 0.08) * (1 + banana * 0.12),
    accelerationMultiplier: 1 + banana * 0.15 + peas * 0.12,
    jumpMultiplier:
      (1 + watermelon * 0.2) * (1 - stackCount(foods, "blueberries") * 0.05),
    hookCooldownMultiplier: 1 - oatmeal * 0.16,
    airControlMultiplier: 1 + applesauce * 0.25,
  };
}
