import { usePageText } from "../i18n/recipes-page";

export function Strength() {
  const t = usePageText().strength;
  return (
    <section className="section strength" aria-labelledby="strength-title">
      <h2 id="strength-title" className="section__title">{t.title}</h2>
      <p className="section__body">{t.body}</p>
      <div className="adjust">
        <div className="adjust__item">
          <p className="adjust__head">{t.strong}</p>
          <p>{t.strongText}</p>
        </div>
        <div className="adjust__item">
          <p className="adjust__head">{t.weak}</p>
          <p>{t.weakText}</p>
        </div>
      </div>
      <p className="section__small">{t.note}</p>
    </section>
  );
}
