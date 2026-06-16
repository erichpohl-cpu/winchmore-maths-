/* nav.js — shared navigation + animation behaviour */

function toggleMenu(btn) {
  const menu = document.getElementById('mobile-nav');
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
}

document.addEventListener('DOMContentLoaded', function () {

  // ── Accordion for topic term blocks ──
  document.querySelectorAll('.term-title').forEach(title => {
    const body = title.nextElementSibling;
    body.style.maxHeight = '0';
    body.style.overflow = 'hidden';
    body.style.transition = 'max-height .35s ease';
    title.addEventListener('click', () => {
      const isOpen = title.classList.toggle('open');
      body.style.maxHeight = isOpen ? body.scrollHeight + 'px' : '0';
    });
  });

  // Open first term by default
  const first = document.querySelector('.term-title');
  if (first) {
    first.classList.add('open');
    const fb = first.nextElementSibling;
    // Delay so layout is ready
    setTimeout(() => { fb.style.maxHeight = fb.scrollHeight + 'px'; }, 50);
  }

  // ── Scroll-reveal animations ──
  const revealSel = '.card, .info-card, .hw-card, .game-card, .resource-link, .platform-section, .term-block';
  const items = document.querySelectorAll(revealSel);

  if ('IntersectionObserver' in window && items.length) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(i => obs.observe(i));
  } else {
    // Fallback — show everything
    items.forEach(i => i.classList.add('in-view'));
  }
});
