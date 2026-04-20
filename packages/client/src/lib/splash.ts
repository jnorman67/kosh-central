/** Dismiss the initial splash element rendered by index.html.
 *
 *  Returning visitors (flag set in localStorage) fade out immediately once the first view's data
 *  is ready. First-time visitors instead see a "Take me to 9th & St. Barbe" CTA; the splash only
 *  fades once they click it, and clicking persists the flag so subsequent visits skip the CTA.
 *
 *  Idempotent: only the first call does work; later calls are no-ops. */
const SEEN_KEY = 'kosh.splashSeen';
let handled = false;

export function hideSplash(): void {
    if (handled) return;
    handled = true;
    const el = document.getElementById('splash');
    if (!el) return;

    const returning = (() => {
        try {
            return localStorage.getItem(SEEN_KEY) === '1';
        } catch {
            return false;
        }
    })();

    if (returning) {
        fadeOutAndRemove(el);
        return;
    }

    const spinner = el.querySelector<HTMLElement>('.splash-spinner');
    const cta = el.querySelector<HTMLButtonElement>('.splash-cta');
    if (spinner) spinner.style.display = 'none';
    if (!cta) {
        // Safety net for an unexpectedly missing CTA (e.g. stale cached HTML).
        fadeOutAndRemove(el);
        return;
    }
    cta.style.display = '';
    cta.focus();
    cta.addEventListener(
        'click',
        () => {
            try {
                localStorage.setItem(SEEN_KEY, '1');
            } catch {
                // Private mode / disabled storage — user will see the CTA again next time.
            }
            fadeOutAndRemove(el);
        },
        { once: true },
    );
}

function fadeOutAndRemove(el: HTMLElement): void {
    el.classList.add('splash-hidden');
    const remove = () => el.remove();
    el.addEventListener('transitionend', remove, { once: true });
    // Safety net in case the transition never fires (e.g. display:none ancestor).
    window.setTimeout(remove, 600);
}
