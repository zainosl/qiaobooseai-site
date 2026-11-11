(() => {
  const header = document.getElementById('q-site-header');
  if (!header) return;
  const menu = header.querySelector('.q-menu');
  const nav = header.querySelector('nav');
  const products = header.querySelector('details');
  function close() { nav.classList.remove('q-open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '展开官网菜单'); products.open = false; }
  menu.addEventListener('click', () => { const open = nav.classList.toggle('q-open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '收起官网菜单' : '展开官网菜单'); });
  document.addEventListener('click', event => { if (!header.contains(event.target)) close(); });
  header.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && (products.open || nav.classList.contains('q-open'))) { const target = nav.classList.contains('q-open') ? menu : products.querySelector('summary'); close(); target.focus(); } });
  matchMedia('(max-width:820px)').addEventListener('change', close);
})();
