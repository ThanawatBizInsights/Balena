import { AbsoluteFill, useCurrentFrame } from "remotion";
import { findRecipe } from "../config/recipes";
import { RecipeScene } from "./RecipeScene";

export type RecipeCompositionProps = { recipeId: string };

/** One composition for all four recipes; the recipe is chosen by input props. */
export function RecipeComposition({ recipeId }: RecipeCompositionProps) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <RecipeScene recipe={findRecipe(recipeId)} frame={frame} />
    </AbsoluteFill>
  );
}
