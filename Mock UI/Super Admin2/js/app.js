// ==================== SUPER ADMIN — BOOTSTRAP ====================
document.addEventListener('DOMContentLoaded', () => {
  state.accessGym = GYMS[0] ? GYMS[0].id : null;
  state.accessRole = 'HR Manager';
  state.accessCompareRole = 'HR Manager';
  state.billingFilters = { status: 'all', gym: 'all', q: '' };
  state.gymSort = { key: 'name', dir: 'asc' };
  renderAll();
});

// "/" focuses the global search when the user is not already typing.
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const search = document.getElementById('global-search');
  if (search) { e.preventDefault(); search.focus(); }
});
