/* Nocta — the Privacy Policy and Terms of Service, as a subpage (Settings ›
 * Privacy and terms). The text lives once, in the public pages
 * (public/privacy.html, public/terms.html), which are also what Google and
 * anyone outside the app reads. This sheet loads that page and shows its body
 * in the app's type, minus the page's own logo, title and footer.
 *
 * A link to the other document swaps to it here; links out (Google's policy,
 * email) leave the app as usual. */
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';

export const LEGAL_DOCS = {
  privacy: { title: 'Privacy Policy', path: '/privacy.html' },
  terms: { title: 'Terms of Service', path: '/terms.html' },
};

/* '/terms', '/terms.html', 'https://…/terms' → 'terms' (null for anything else) */
function docFor(href) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const m = /^\/(privacy|terms)(\.html)?\/?$/.exec(url.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/* the public page's body: drop what the sheet already shows */
async function loadDoc(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const page = new DOMParser().parseFromString(await res.text(), 'text/html');
  const main = page.querySelector('main');
  if (!main) throw new Error(`${path}: no <main>`);
  main.querySelectorAll('.legal-home, h1, footer').forEach((el) => el.remove());
  // links out of Nocta open beside it
  main.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener';
  });
  return main.innerHTML;
}

export function LegalSheet() {
  const { sheet, closeSheet } = useStore();
  const [docKey, setDocKey] = useState(LEGAL_DOCS[sheet?.doc] ? sheet.doc : 'privacy');
  const doc = LEGAL_DOCS[docKey];
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setFailed(false);
    loadDoc(doc.path)
      .then((h) => alive && setHtml(h))
      .catch((e) => {
        console.warn('[legal]', e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [doc.path]);

  /* "see our Terms of Service" inside the privacy page: switch in place */
  function onClick(e) {
    const a = e.target.closest('a');
    const other = a && docFor(a.getAttribute('href'));
    if (!other) return;
    e.preventDefault();
    setDocKey(other);
    e.currentTarget.closest('.sheet-body')?.scrollTo({ top: 0 });
  }

  return (
    <Sheet title={doc.title} onClose={closeSheet} variant="page">
      {failed ? (
        <p className="settings-note">
          Couldn’t load the {doc.title.toLowerCase()}. Check your connection and try again.
        </p>
      ) : html == null ? (
        <p className="settings-note">Loading…</p>
      ) : (
        // our own static page, same origin (public/), not user content
        <article className="legal-doc" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </Sheet>
  );
}
