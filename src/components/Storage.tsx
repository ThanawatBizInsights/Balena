import { usePageText } from "../i18n/recipes-page";

export function Storage() {
  const t = usePageText().storage;
  return (
    <section className="section storage" aria-labelledby="storage-title">
      <h2 id="storage-title" className="section__title">{t.title}</h2>
      <p className="section__body">{t.body}</p>
    </section>
  );
}
