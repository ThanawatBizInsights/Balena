import { site } from "../config/site";

export function FooterActions() {
  return (
    <footer className="footer">
      <div className="footer__actions">
        <ActionLink href={site.links.order} variant="coffee">สั่งซื้อ Balena Cold Brew</ActionLink>
        <ActionLink href={site.links.ask} variant="outline">สอบถามวิธีชง</ActionLink>
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
