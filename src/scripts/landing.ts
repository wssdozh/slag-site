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

// A permanently moving strip. No arrows, no snapping, no step timer: the rail drifts at a
// constant speed, wraps through a cloned copy of its slides, and yields to a pointer without
// pulling anywhere. Reduced motion stops it dead — an endless loop is exactly what that setting
// is asking to be spared from.
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

  const cycleWidth = () =>
    (slides[total] ? leftOf(slides[total]!) : 0) - (slides[0] ? leftOf(slides[0]!) : 0);

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
    count.textContent = pad((nearest() % total) + 1);
    const cycle = cycleWidth();
    // The bar follows the whole loop, not the slide: the strip never stops, so a bar that jumps
    // in thirds would read as three separate moves instead of one continuous one.
    const fraction = cycle > 0 ? (((track.scrollLeft % cycle) + cycle) % cycle) / cycle : 0;
    progress?.style.setProperty('transform', `scaleX(${fraction.toFixed(4)})`);
  };

  // A jump with no animation: at the seam the clone and the original are the same pixels, so
  // moving the scroll offset by one cycle is invisible.
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

  let frame = 0;
  track.addEventListener(
    'scroll',
    () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    },
    { passive: true },
  );

  // Mouse drag. Touch needs no code: the browser scrolls the rail natively, with momentum.
  // Capture starts only after the pointer actually moves, because capturing on pointerdown
  // retargets the click that follows and a picture would stop opening the lightbox.
  let pressing = false;
  let dragging = false;
  let pressX = 0;
  let startLeft = 0;
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
      track.classList.add('is-dragging');
    }
    track.scrollLeft = startLeft - dx;
  });

  const endDrag = (event?: PointerEvent) => {
    pressing = false;
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    if (event && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    // No snap back: the strip carries on from wherever the hand left it.
  };

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // Keyboard still steps one slide, and the drift holds for a moment so the two do not fight.
  let holdUntil = 0;
  track.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    holdUntil = performance.now() + 900;
    goTo(nearest() + (event.key === 'ArrowRight' ? 1 : -1));
  });

  // Drift. rAF stops on its own in a hidden tab, so nothing has to pause it there.
  // The position is accumulated as a float and written out every frame: at 26px/s one frame
  // moves less than a CSS pixel, and `scrollLeft += 0.4` rounds back to the same integer every
  // time, so the strip would never leave the first slide.
  const speed = 70; // px per second: a slide every eight seconds, slow enough to read
  let position = track.scrollLeft;
  let last = 0;
  let wroteAt = 0;

  const syncPosition = () => {
    position = track.scrollLeft;
  };

  // A scroll we did not write (touch, wheel, keyboard) has to re-seed the accumulator.
  track.addEventListener(
    'scroll',
    () => {
      if (performance.now() - wroteAt > 120) syncPosition();
    },
    { passive: true },
  );

  const tick = (time: number) => {
    requestAnimationFrame(tick);
    const dt = last ? Math.min((time - last) / 1000, 0.064) : 0;
    last = time;
    if (dragging || calm.matches || performance.now() < holdUntil) return;
    if (document.querySelector('[data-lightbox]')?.hasAttribute('open')) return;

    position += speed * dt;
    const cycle = cycleWidth();
    if (cycle > 0 && position >= cycle) {
      position -= cycle;
      jumpTo(position);
    }
    wroteAt = performance.now();
    track.scrollLeft = position;
  };

  track.addEventListener('pointerdown', syncPosition);
  track.addEventListener('pointerup', syncPosition);

  requestAnimationFrame(tick);
  paint();
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
