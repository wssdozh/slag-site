// Progressive reveal: motion.css already hides the targets, this only marks them as they come
// into view. Without this file the inline watchdog in Base.astro drops the `.js` class and the
// page is plainly visible, so the landing never depends on a script to show its content.
const container = ':is(.section, .cta)';
const nested = '.grid, .plans, .faq, .changelog';

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const targets: HTMLElement[] = [];

for (const child of document.querySelectorAll<HTMLElement>(`${container} > *`)) {
  if (child.matches(nested)) {
    // A grid is one block of rows, but the cards inside it should cascade one after another.
    for (const inner of Array.from(child.children)) {
      if (inner instanceof HTMLElement) targets.push(inner);
    }
  } else {
    targets.push(child);
  }
}

const reveal = (element: Element) => element.classList.add('is-in');

if (calm || !('IntersectionObserver' in window)) {
  for (const element of targets) reveal(element);
} else {
  // Siblings cascade by their order inside one parent; anything past six is close enough to the
  // sixth that another 40ms would read as a slow load rather than a sequence.
  const seen = new Map<Element, number>();
  for (const element of targets) {
    const parent = element.parentElement;
    if (!parent) continue;
    const index = seen.get(parent) ?? 0;
    seen.set(parent, index + 1);
    element.style.setProperty('--stagger-index', String(Math.min(index, 5)));
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  for (const element of targets) observer.observe(element);
}

document.documentElement.dataset.reveal = 'ready';

// Module scope: two landing scripts must not share top-level names in a global type check.
export {};
