import { AbsoluteFill, useCurrentFrame } from "remotion";
import { findRecipe, type Lang } from "../config/recipes";
import { RecipeScene } from "./RecipeScene";

export type RecipeCompositionProps = { recipeId: string; lang: Lang };

/** One composition for all four recipes; the recipe is chosen by input props. */
export function RecipeComposition({ recipeId, lang }: RecipeCompositionProps) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <RecipeScene recipe={findRecipe(recipeId, lang)} frame={frame} />
    </AbsoluteFill>
  );
}
