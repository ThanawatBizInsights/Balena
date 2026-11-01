import { Composition } from "remotion";
import { Main, MAIN_FRAMES } from "./Main";
import { Social, SOCIAL_FRAMES } from "./Social";

export function Root() {
  return (
    <>
      <Composition id="Main" component={Main} durationInFrames={MAIN_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="Social" component={Social} durationInFrames={SOCIAL_FRAMES} fps={30} width={1080} height={1920} />
    </>
  );
}
