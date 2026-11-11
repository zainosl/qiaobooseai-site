(() => {
  const header = document.getElementById('q-site-header');
  if (!header) return;
  const menu = header.querySelector('.q-menu');
  const nav = header.querySelector('nav');
  const products = header.querySelector('details');
  const summary = products.querySelector('summary');
  const hover = matchMedia('(min-width:821px) and (hover:hover) and (pointer:fine)');
  let leaveTimer;
  function close() {
    clearTimeout(leaveTimer);
    nav.classList.remove('q-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', '展开官网菜单');
    products.open = false;
  }
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('q-open');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '收起官网菜单' : '展开官网菜单');
    if (!open) products.open = false;
  });
  products.addEventListener('pointerenter', () => { clearTimeout(leaveTimer); if (hover.matches) products.open = true; });
  products.addEventListener('pointerleave', () => { if (hover.matches) leaveTimer = setTimeout(() => { if (!products.contains(document.activeElement)) products.open = false; }, 180); });
  summary.addEventListener('click', event => { if (hover.matches && event.detail > 0 && products.open) event.preventDefault(); });
  products.addEventListener('focusout', event => { if (!products.contains(event.relatedTarget) && !products.matches(':hover')) products.open = false; });
  document.addEventListener('click', event => { if (!header.contains(event.target)) close(); else if (!products.contains(event.target)) products.open = false; });
  header.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (products.open || nav.classList.contains('q-open'))) {
      const target = nav.classList.contains('q-open') ? menu : summary;
      close();target.focus();
    }
  });
  matchMedia('(max-width:820px)').addEventListener('change', close);
})();
