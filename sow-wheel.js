/* sow-wheel.js — "What are we teaching this week?" combination-lock widget.
 * Reads data/topics.json (extracted from the department's scheme-of-work
 * documents) and works out last/this/next week's topic for each year
 * group & set, purely from today's date — nothing needs updating by hand
 * during the year. If the source documents change, re-run the extraction
 * and replace data/topics.json; this script doesn't need touching.
 */
(function () {

  // ---- 2026-27 school calendar: Monday of every teaching week -------
  // Built from the published half-term dates. If Winchmore's calendar
  // changes, edit the block list below (start/end of each half-term) —
  // everything else recalculates automatically.
  var TERM_BLOCKS = [
    ['Autumn 1', '2026-09-02', '2026-10-23'],
    ['Autumn 2', '2026-11-02', '2026-12-11'],
    ['Spring 1', '2027-01-04', '2027-02-12'],
    ['Spring 2', '2027-02-22', '2027-03-25'],
    ['Summer 1', '2027-04-12', '2027-05-28'],
    ['Summer 2', '2027-06-07', '2027-07-23']
  ];

  function mondayOf(d) {
    var day = d.getDay(); // 0=Sun..6=Sat
    var diff = (day === 0 ? -6 : 1 - day);
    var m = new Date(d);
    m.setDate(d.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m;
  }

  var CALENDAR = []; // [{label, monday: Date}]
  TERM_BLOCKS.forEach(function (block) {
    var m = mondayOf(new Date(block[1] + 'T00:00:00'));
    var endM = mondayOf(new Date(block[2] + 'T00:00:00'));
    while (m <= endM) {
      CALENDAR.push({ label: block[0], monday: new Date(m) });
      m = new Date(m);
      m.setDate(m.getDate() + 7);
    }
  });

  function currentWeekIndex() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var idx = 0;
    for (var i = 0; i < CALENDAR.length; i++) {
      if (CALENDAR[i].monday <= today) idx = i;
      else break;
    }
    return idx;
  }

  // ---- Year / set groups shown in the picker -------------------------
  var GROUPS = [
    { year: 'Year 7', sets: [{ key: 'year7', label: 'All sets' }] },
    { year: 'Year 8', sets: [{ key: 'year8', label: 'All sets' }] },
    { year: 'Year 9', sets: [
        { key: 'year9-set12', label: 'Set 1 & 2' },
        { key: 'year9-set3', label: 'Set 3' },
        { key: 'year9-set45', label: 'Set 4 & 5' }
      ] },
    { year: 'Year 10', sets: [
        { key: 'year10-set12', label: 'Set 1 & 2 Higher' },
        { key: 'year10-set3', label: 'Set 3 Higher' },
        { key: 'year10-set45', label: 'Set 4 & 5' },
        { key: 'year10-ocr', label: 'OCR Foundation' }
      ] },
    { year: 'Year 11', sets: [
        { key: 'year11-set12', label: 'Set 1 & 2 Higher' },
        { key: 'year11-set3', label: 'Set 3 Higher' },
        { key: 'year11-set45', label: 'Set 4 & 5' },
        { key: 'year11-ocr', label: 'OCR Foundation' }
      ] }
  ];

  var topicsData = null;
  var state = { yearIdx: 0, setKey: GROUPS[0].sets[0].key };

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function weekAt(weeks, idx) {
    if (!weeks || !weeks.length) return null;
    var clamped = Math.max(0, Math.min(idx, weeks.length - 1));
    return weeks[clamped];
  }

  function renderTabs() {
    var tabsEl = document.getElementById('week-year-tabs');
    var pillsEl = document.getElementById('week-set-pills');
    if (!tabsEl) return;

    tabsEl.innerHTML = '';
    GROUPS.forEach(function (g, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'week-tab' + (i === state.yearIdx ? ' active' : '');
      btn.textContent = g.year;
      btn.addEventListener('click', function () {
        state.yearIdx = i;
        state.setKey = GROUPS[i].sets[0].key;
        renderTabs();
        renderWheel();
      });
      tabsEl.appendChild(btn);
    });

    var group = GROUPS[state.yearIdx];
    pillsEl.innerHTML = '';
    if (group.sets.length > 1) {
      pillsEl.style.display = 'flex';
      group.sets.forEach(function (s) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'week-pill' + (s.key === state.setKey ? ' active' : '');
        btn.textContent = s.label;
        btn.addEventListener('click', function () {
          state.setKey = s.key;
          renderTabs();
          renderWheel();
        });
        pillsEl.appendChild(btn);
      });
    } else {
      pillsEl.style.display = 'none';
    }
  }

  function slotHTML(entry) {
    if (!entry) {
      return '<span class="wheel-topic-text">—</span>';
    }
    return '<span class="wheel-topic-text">' + esc(entry.topic) + '</span>' +
      (entry.subskills && entry.subskills.length ? '<span class="wheel-info-dot" aria-hidden="true">i</span>' : '');
  }

  function openPopup(title, subskills) {
    var popup = document.getElementById('week-popup');
    var titleEl = document.getElementById('week-popup-title');
    var listEl = document.getElementById('week-popup-list');
    titleEl.textContent = title;
    listEl.innerHTML = '';
    if (subskills && subskills.length) {
      subskills.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s;
        listEl.appendChild(li);
      });
    } else {
      var li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No subskill breakdown recorded for this topic yet.';
      listEl.appendChild(li);
    }
    popup.hidden = false;
  }

  function renderWheel() {
    var wheelEl = document.getElementById('week-wheel');
    var rangeEl = document.getElementById('week-range');
    if (!wheelEl || !topicsData) return;

    var data = topicsData[state.setKey];
    var idx = currentWeekIndex();
    var prevEntry = data ? weekAt(data.weeks, idx - 1) : null;
    var curEntry = data ? weekAt(data.weeks, idx) : null;
    var nextEntry = data ? weekAt(data.weeks, idx + 1) : null;

    wheelEl.innerHTML =
      '<div class="wheel-slot wheel-prev" data-role="prev">' + slotHTML(prevEntry) + '</div>' +
      '<div class="wheel-slot wheel-current" data-role="current">' + slotHTML(curEntry) + '</div>' +
      '<div class="wheel-slot wheel-next" data-role="next">' + slotHTML(nextEntry) + '</div>';

    var entries = { prev: prevEntry, current: curEntry, next: nextEntry };
    Array.prototype.forEach.call(wheelEl.querySelectorAll('.wheel-slot'), function (el) {
      var role = el.getAttribute('data-role');
      var entry = entries[role];
      if (entry) {
        el.classList.add('clickable');
        el.addEventListener('click', function () {
          var roleLabel = role === 'current' ? ' — this week' : role === 'prev' ? ' — last week' : ' — next week';
          openPopup((data.label || '') + roleLabel + ': ' + entry.topic, entry.subskills);
        });
      }
    });

    if (rangeEl) {
      rangeEl.textContent = data ? data.label : '';
    }
  }

  function init() {
    fetch('data/topics.json?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (json) {
        topicsData = json;
        renderTabs();
        renderWheel();
      })
      .catch(function (err) {
        var wheelEl = document.getElementById('week-wheel');
        if (wheelEl) wheelEl.innerHTML = '<p class="muted">Could not load the scheme of work data.</p>';
        console.error('sow-wheel:', err);
      });

    var closeBtn = document.getElementById('week-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        document.getElementById('week-popup').hidden = true;
      });
    }
    var popup = document.getElementById('week-popup');
    if (popup) {
      popup.addEventListener('click', function (e) {
        if (e.target === popup) popup.hidden = true;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
