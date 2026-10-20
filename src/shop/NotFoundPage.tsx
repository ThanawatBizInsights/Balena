import { Arrow, Shell, useText } from "./ui";

/** Served by Vercel for any unknown address (dist/404.html). */
export function NotFoundPage() {
  return (
    <Shell page="notFound" tone="light">
      <NotFoundBody />
    </Shell>
  );
}

function NotFoundBody() {
  const { notFound: t } = useText();
  return (
    <section className="nf" aria-labelledby="nf-title">
      <p className="nf__giant" aria-hidden="true" lang="en">404</p>
      <h1 id="nf-title" className="h-th">{t.title}</h1>
      <p>{t.text}</p>
      <div className="nf__actions">
        <a className="btn btn--navy" href="/">{t.home}</a>
        <a className="btn btn--light" href="/products">{t.products} <Arrow /></a>
      </div>
    </section>
  );
}
