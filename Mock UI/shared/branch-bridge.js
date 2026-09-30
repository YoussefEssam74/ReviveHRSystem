// ============================================================
// BranchBridge / VacancyBridge — shared links between the two portal files.
//
// The Branch Manager portal (Mock UI/Employee/index.html) and the
// HR portal (Mock UI/HR/index.html) are two separate pages, so the
// only transport they share is the browser's localStorage (same
// file:// origin when both are opened as normal browser tabs).
//
// Two independent streams ride the same mechanism:
//   BranchBridge (revive_branch_queue_v1)  — deductions / warnings / bonuses
//   VacancyBridge (revive_vacancy_queue_v1) — recruitment (vacancy) requests
//
// Flow (same for both):
//   Branch Manager  ->  queue.push([...])         (writes items, status "Pending")
//   HR              ->  queue.decide(...)         (Approved / Rejected + who decided)
//   Branch Manager  ->  listens to the "storage" event, pulls the decision back
//                       so the portal's badge drops.
// ============================================================
function makeQueue(KEY) {

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { /* storage full / disabled — prototype should never crash */ }
  }

  // Add or refresh items WITHOUT ever overwriting an HR decision.
  function push(items) {
    const queue = read();
    const byId = {};
    queue.forEach(i => { byId[i.id] = i; });
    items.forEach(n => {
      const existing = byId[n.id];
      if (existing && (existing.status === 'Approved' || existing.status === 'Rejected')) {
        // HR already decided — keep the decision, refresh descriptive fields only.
        byId[n.id] = Object.assign({}, n, {
          status: existing.status,
          decidedBy: existing.decidedBy,
          decidedNote: existing.decidedNote,
          decidedAt: existing.decidedAt
        });
      } else {
        byId[n.id] = Object.assign({}, existing || {}, n);
      }
    });
    const next = Object.keys(byId).map(k => byId[k]);
    write(next);
    return next;
  }

  // HR records a decision on one item.
  function decide(id, status, decidedBy, note) {
    const queue = read();
    const item = queue.find(x => x.id === id);
    if (!item) return null;
    item.status = status;
    item.decidedBy = decidedBy || '';
    item.decidedNote = note || '';
    item.decidedAt = new Date().toISOString();
    write(queue);
    return item;
  }

  function pending() {
    return read().filter(i => i.status === 'Pending HR');
  }

  function byId(id) {
    return read().find(i => i.id === id) || null;
  }

  // Fires in the OTHER open tab whenever this queue changes.
  function onChange(cb) {
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) cb(read());
    });
  }

  return { KEY, read, write, push, decide, pending, byId, onChange };
}

const BranchBridge = makeQueue('revive_branch_queue_v1');
// Second stream: recruitment (vacancy) requests — same transport, own queue.
const VacancyBridge = makeQueue('revive_vacancy_queue_v1');
