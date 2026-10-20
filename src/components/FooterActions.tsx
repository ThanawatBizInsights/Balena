import { usePageText } from "../i18n/recipes-page";
import { site } from "../config/site";

export function FooterActions() {
  const t = usePageText().footer;
  return (
    <footer className="footer">
      <div className="footer__actions">
        <ActionLink href={site.links.order} variant="coffee">{t.order}</ActionLink>
        <ActionLink href={site.links.ask} variant="outline">{t.ask}</ActionLink>
      </div>
      <p className="footer__brand">{site.brand}</p>
    </footer>
  );
}

/** A link styled as a button. Without a configured URL it renders disabled. */
function ActionLink({ href, variant, children }: { href: string; variant: "coffee" | "outline"; children: string }) {
  if (!href) {
    return (
      <button type="button" className={`btn btn--${variant} btn--block`} disabled>
        {children}
      </button>
    );
  }
  return (
    <a className={`btn btn--${variant} btn--block`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
