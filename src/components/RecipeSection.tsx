import { useRef, useState } from "react";
import { STARTER_NOTE, liquidColors, recipes, type Recipe } from "../config/recipes";
import { assetUrl } from "../config/site";
import { RecipeAnimation } from "./RecipeAnimation";

export function RecipeSection() {
  const [selectedId, setSelectedId] = useState(recipes[0].id);
  const detail = useRef<HTMLDivElement>(null);
  const selected = recipes.find((r) => r.id === selectedId) ?? recipes[0];

  const choose = (id: string) => {
    setSelectedId(id);
    // Bring the opened recipe into view on phones, where it sits below the cards.
    requestAnimationFrame(() => {
      const el = detail.current;
      if (!el) return;
      if (el.getBoundingClientRect().top > window.innerHeight * 0.6) {
        el.scrollIntoView({ block: "start" });
      }
      el.focus({ preventScroll: true });
    });
  };

  return (
    <section id="recipes" className="section recipes" aria-labelledby="recipes-title">
      <h2 id="recipes-title" className="section__title">เลือกเมนู</h2>
      <p className="section__lead">แตะเมนูเพื่อดูส่วนผสม วิธีชง และภาพเคลื่อนไหว</p>

      <div className="recipe-cards">
        {recipes.map((r) => (
          <button
            key={r.id}
            type="button"
            className="recipe-card"
            aria-pressed={r.id === selectedId}
            aria-controls="recipe-detail"
            onClick={() => choose(r.id)}
          >
            <span className="recipe-card__name">{r.name}</span>
            <span className="recipe-card__summary">{r.summary}</span>
            <RatioBar recipe={r} />
          </button>
        ))}
      </div>

      <div id="recipe-detail" ref={detail} tabIndex={-1} className="recipe-detail" aria-live="polite">
        <RecipeDetail recipe={selected} />
      </div>
    </section>
  );
}

/** Proportion of each measured liquid, drawn to scale. */
function RatioBar({ recipe }: { recipe: Recipe }) {
  const liquids = recipe.pours
    .map((p) => recipe.ingredients.find((i) => i.id === p.ingredientId)!)
    .sort((a, b) => Number(a.kind !== "coldbrew") - Number(b.kind !== "coldbrew"));
  const total = liquids.reduce((n, i) => n + (i.ml ?? 0), 0);
  return (
    <span className="ratio" aria-hidden="true">
      {liquids.map((i) => (
        <span
          key={i.id}
          className="ratio__seg"
          style={{ flexGrow: i.ml ?? 0, flexBasis: 0, background: liquidColors[i.kind as keyof typeof liquidColors] }}
          title={`${i.name} ${i.ml}/${total}`}
        />
      ))}
    </span>
  );
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  return (
    <article className="detail" aria-labelledby={`title-${recipe.id}`}>
      <h3 id={`title-${recipe.id}`} className="detail__title">{recipe.name}</h3>
      <p className="note">{STARTER_NOTE}</p>
      {recipe.photo?.src && (
        <img
          className="detail__photo"
          src={assetUrl(recipe.photo.src)}
          alt={recipe.photo.alt}
          width={recipe.photo.width}
          height={recipe.photo.height}
          loading="lazy"
          decoding="async"
        />
      )}

      <div className="detail__cols">
        <div>
          <h4 className="detail__sub">ส่วนผสม</h4>
          <ul className="ingredients">
            {recipe.ingredients.map((i) => (
              <li key={i.id} className={i.optional ? "is-optional" : undefined}>
                <span className="ingredients__name">{i.name}</span>
                <span className="ingredients__amount">{i.amount}</span>
              </li>
            ))}
          </ul>

          <h4 className="detail__sub">วิธีชง</h4>
          <ol className="steps">
            {recipe.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <RecipeAnimation recipe={recipe} />
      </div>
    </article>
  );
}
