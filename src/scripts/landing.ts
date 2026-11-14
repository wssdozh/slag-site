// The checkout is not wired to an acquirer yet, and the bank wants a real, clickable path with a
// plain message instead of a dead button. The note unfolds from 0fr to 1fr instead of appearing:
// a 12px jump under the cursor reads as a layout bug, a 180ms unfold reads as an answer.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pay]')) {
  button.addEventListener('click', () => {
    const note = button.parentElement?.querySelector<HTMLElement>('[data-pay-note]');
    if (!note) return;
    const open = note.dataset.open === 'true';
    note.dataset.open = String(!open);
    button.setAttribute('aria-expanded', String(!open));
  });
}

const pad = (value: number) => String(value).padStart(2, '0');

const track = document.querySelector<HTMLElement>('[data-carousel-track]');
const count = document.querySelector<HTMLElement>('[data-carousel-count]');
const progress = document.querySelector<HTMLElement>('[data-carousel-progress]');
const box = document.querySelector<HTMLDialogElement>('[data-lightbox]');
const stage = box?.querySelector<HTMLImageElement>('[data-stage]') ?? null;
const caption = box?.querySelector<HTMLElement>('[data-caption]') ?? null;
const counter = box?.querySelector<HTMLElement>('[data-counter]') ?? null;
// Every picture on the page that opens full size: the three in the rail and the phone beside it.
// The rail clones its slides, so the phone cannot be found through the rail's children.
const originals = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-shot]')).sort(
  (a, b) => Number(a.dataset.index ?? 0) - Number(b.dataset.index ?? 0),
);
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

// Carousel without arrows: the rail is dragged, swiped, or moves on its own when nobody is
// touching it. Wrapping past the last slide needs a second copy of the slides in the DOM —
// when the first clone settles exactly where the first slide was, the rail jumps back one
// cycle without animation, so the pictures appear to loop forever.
if (track && count && originals.length > 1) {
  const total = Array.from(track.querySelectorAll<HTMLButtonElement>('[data-shot]')).length;
  const originSlides = Array.from(track.querySelectorAll<HTMLElement>('.shot'));

  for (const slide of originSlides) {
    const clone = slide.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    for (const button of clone.querySelectorAll<HTMLElement>('button')) button.tabIndex = -1;
    track.append(clone);
  }

  const slides = Array.from(track.querySelectorAll<HTMLElement>('.shot'));
  const leftOf = (slide: HTMLElement) => slide.offsetLeft - track.offsetLeft;

  // Slides differ in width (the phone one is narrow), so there is no single stride: the
  // current slide is whichever one starts closest to the left edge.
  const nearest = () => {
    let best = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const delta = Math.abs(leftOf(slide) - track.scrollLeft);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    });
    return best;
  };

  const paint = () => {
    const index = nearest() % total;
    count.textContent = pad(index + 1);
    progress?.style.setProperty('transform', `scaleX(${(index + 1) / total})`);
  };

  const jumpTo = (left: number) => {
    const previous = track.style.scrollBehavior;
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = left;
    track.style.scrollBehavior = previous;
  };

  const goTo = (physical: number) => {
    const slide = slides[Math.max(0, Math.min(physical, slides.length - 1))];
    if (!slide) return;
    track.scrollTo({ left: leftOf(slide), behavior: 'smooth' });
  };

  const settle = () => {
    const cycle = (slides[total] ? leftOf(slides[total]!) : 0) - (slides[0] ? leftOf(slides[0]!) : 0);
    if (cycle > 0 && track.scrollLeft >= cycle - 2) {
      jumpTo(track.scrollLeft - cycle);
      paint();
    }
  };

  let pressX = 0;
  let startLeft = 0;
  let idleTimer = 0;

  track.addEventListener(
    'scroll',
    () => {
      paint();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!dragging) settle();
      }, 180);
    },
    { passive: true },
  );

  // Mouse drag. Touch needs no code: the browser scrolls the rail natively, with momentum.
  // Capture starts only after the pointer actually moves: capturing on pointerdown retargets
  // the following click to the rail, and a click on a picture would stop opening the lightbox.
  let pressing = false;
  let dragging = false;
  let pointerId = -1;

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    pressing = true;
    pressX = event.clientX;
    startLeft = track.scrollLeft;
    pointerId = event.pointerId;
  });

  track.addEventListener('pointermove', (event) => {
    if (!pressing || event.pointerId !== pointerId) return;
    const dx = event.clientX - pressX;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      dragging = true;
      track.setPointerCapture(event.pointerId);
      track.style.scrollSnapType = 'none';
      track.style.scrollBehavior = 'auto';
      track.classList.add('is-dragging');
      stop();
    }
    track.scrollLeft = startLeft - dx;
  });

  const endDrag = (event?: PointerEvent) => {
    pressing = false;
    if (!dragging) return;
    dragging = false;
    track.style.scrollSnapType = '';
    track.style.scrollBehavior = '';
    track.classList.remove('is-dragging');
    if (event && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    goTo(nearest());
    start();
  };

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(nearest() + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(nearest() - 1);
    }
  });

  // Autoplay stops for a pointer, for focus inside the rail, for a hidden tab and for the
  // lightbox; reduced motion turns it off for good.
  let timer = 0;
  let paused = false;

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  }

  function start() {
    if (calm.matches || timer) return;
    timer = window.setInterval(() => {
      if (paused || dragging) return;
      if (document.querySelector('[data-lightbox]')?.hasAttribute('open')) return;
      goTo(nearest() + 1);
    }, 4200);
  }

  track.addEventListener('pointerenter', () => {
    paused = true;
  });
  track.addEventListener('pointerleave', () => {
    paused = false;
  });
  track.addEventListener('focusin', () => {
    paused = true;
  });
  track.addEventListener('focusout', () => {
    paused = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  paint();
  start();
}

// Lightbox: a native <dialog> does the modal work (focus trap, Esc, backdrop, top layer), so
// this only swaps the picture and keeps the index in range. A press that moved is a drag of
// the rail, not a click on the picture.
if (box && stage && caption && counter && originals.length > 0) {
  let index = 0;
  let pressX: number | null = null;
  let pressY: number | null = null;

  const paint = () => {
    const opener = originals[index];
    if (!opener) return;
    const src = opener.dataset.src ?? '';
    const text = opener.dataset.caption ?? '';
    stage.src = src;
    stage.alt = text;
    stage.width = Number(opener.dataset.width ?? 0);
    stage.height = Number(opener.dataset.height ?? 0);
    caption.textContent = text;
    counter.textContent = `${pad(index + 1)} / ${pad(originals.length)}`;
  };

  const step = (delta: number) => {
    index = (index + delta + originals.length) % originals.length;
    paint();
  };

  track?.addEventListener('pointerdown', (event) => {
    pressX = event.clientX;
    pressY = event.clientY;
  });

  // Delegated from the document, so the phone outside the rail and the cloned slides inside it
  // all open the picture their `data-index` points at.
  document.addEventListener('click', (event) => {
    const opener = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-shot]') : null;
    if (!opener) return;
    const dragged =
      event.detail > 0 &&
      pressX !== null &&
      pressY !== null &&
      Math.abs(event.clientX - pressX) + Math.abs(event.clientY - pressY) > 10;
    if (dragged) return;
    index = Number(opener.dataset.index ?? 0);
    paint();
    box.showModal();
  });

  box.querySelector('[data-prev]')?.addEventListener('click', () => step(-1));
  box.querySelector('[data-next]')?.addEventListener('click', () => step(1));
  box.querySelector('[data-close]')?.addEventListener('click', () => box.close());

  box.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });

  // A click that lands on the dialog itself, not on anything inside it, is a backdrop click.
  box.addEventListener('click', (event) => {
    if (event.target === box) box.close();
  });

  let swipeFrom: number | null = null;
  box.addEventListener('pointerdown', (event) => {
    swipeFrom = event.clientX;
  });
  box.addEventListener('pointerup', (event) => {
    if (swipeFrom === null) return;
    const delta = event.clientX - swipeFrom;
    swipeFrom = null;
    if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
  });
}

// Module scope: two landing scripts must not share top-level names in a global type check.
export {};
