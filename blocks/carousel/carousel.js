export default function init(el) {
  const slides = [...el.querySelectorAll(':scope > div')];
  if (!slides.length) return;

  // Build the scrollable track
  const track = document.createElement('div');
  track.className = 'carousel-track';
  slides.forEach((slide, i) => {
    slide.classList.add('carousel-slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    track.append(slide);
  });
  el.append(track);

  // No navigation needed for a single slide
  if (slides.length < 2) return;

  const goTo = (i) => {
    const target = slides[Math.max(0, Math.min(i, slides.length - 1))];
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  };

  // Prev / next arrows
  const nav = document.createElement('div');
  nav.className = 'carousel-nav';
  const makeArrow = (dir, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `carousel-arrow carousel-arrow-${dir}`;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => {
      const current = Math.round(track.scrollLeft / track.clientWidth);
      goTo(dir === 'prev' ? current - 1 : current + 1);
    });
    return btn;
  };
  nav.append(makeArrow('prev', 'Previous slide'), makeArrow('next', 'Next slide'));
  el.append(nav);

  // Dots
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dots.append(dot);
  });
  el.append(dots);

  // Keep dots in sync with the current slide
  const setActive = () => {
    const current = Math.round(track.scrollLeft / track.clientWidth);
    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
      dot.setAttribute('aria-current', i === current ? 'true' : 'false');
    });
  };
  track.addEventListener('scroll', () => {
    window.requestAnimationFrame(setActive);
  }, { passive: true });
  setActive();
}
