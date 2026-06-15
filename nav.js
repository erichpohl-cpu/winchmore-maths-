/* nav.js — shared navigation behaviour */
function toggleMenu(btn) {
  const menu = document.getElementById('mobile-nav');
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
}

// Accordion for topic blocks
document.querySelectorAll('.term-title').forEach(title => {
  const body = title.nextElementSibling;
  body.style.maxHeight = '0';
  body.style.overflow  = 'hidden';
  body.style.transition = 'max-height .35s ease';

  title.addEventListener('click', () => {
    const isOpen = title.classList.toggle('open');
    body.style.maxHeight = isOpen ? body.scrollHeight + 'px' : '0';
  });
});

// Open first term by default if present
const first = document.querySelector('.term-title');
if (first) {
  first.classList.add('open');
  first.nextElementSibling.style.maxHeight = first.nextElementSibling.scrollHeight + 'px';
}
