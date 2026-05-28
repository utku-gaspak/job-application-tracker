import { ExternalLink, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="px-4 py-2 text-xs text-deco-muted md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-deco-muted">&copy; 2026 Utku Gaspak</p>
        <p className="text-deco-muted">Traxr job tracker and Scout workflow</p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/utku-gaspak"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-deco-foreground underline decoration-border-gold-muted decoration-1 underline-offset-2 hover:text-primary-gold hover:decoration-primary-gold"
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="mailto:utkugaspak@gmail.com"
            className="inline-flex items-center gap-1 font-medium text-deco-foreground underline decoration-border-gold-muted decoration-1 underline-offset-2 hover:text-primary-gold hover:decoration-primary-gold"
          >
            <Mail className="h-3 w-3" />
            utkugaspak@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
