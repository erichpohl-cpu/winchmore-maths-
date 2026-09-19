/* timetable.js — live faculty corridor view.
 *
 * Reads data/timetable.json (extracted from the master Maths & Computing
 * timetable PDF — maths classes only) and shows what is happening in each
 * maths room right now. Refreshing the page re-reads the clock.
 *
 * ── THINGS YOU MAY NEED TO EDIT ──────────────────────────────────────
 *  WEEK1_MONDAY  the Monday of any week that is a WEEK 1 in the two-week
 *                cycle. Everything else alternates from there. If the site
 *                shows the wrong week, move this back or forward 7 days.
 *  PERIODS       the bell times. Wednesday is defined separately because
 *                period 3 onwards starts at 11:20 for PSHCE.
 *  TERM_BLOCKS   the school's term dates. Outside these, the page says
 *                there are no lessons this week.
 *  CLOSURES      one-off closures (bank holidays, INSET) inside term time.
 * ---------------------------------------------------------------------
 */
(function () {

  var WEEK1_MONDAY = '2026-09-07';   // <- week beginning 7 Sep 2026 = Week 1

  var TERM_BLOCKS = [
    ['Autumn 1', '2026-09-02', '2026-10-23'],
    ['Autumn 2', '2026-11-02', '2026-12-11'],
    ['Spring 1', '2027-01-04', '2027-02-12'],
    ['Spring 2', '2027-02-22', '2027-03-25'],
    ['Summer 1', '2027-04-12', '2027-05-28'],
    ['Summer 2', '2027-06-07', '2027-07-23']
  ];

  // Bank holidays / INSET that fall inside a term block
  var CLOSURES = ['2027-05-03'];     // early May bank holiday 2027

  // Standard day. "p" is the period key in the data; form/lunch have none.
  var STANDARD = [
    { key: '1', label: 'Period 1', start: '08:30', end: '09:30' },
    { key: '2', label: 'Period 2', start: '09:30', end: '10:30' },
    { key: 'form', label: 'Form time', start: '10:30', end: '11:15' },
    { key: '3', label: 'Period 3', start: '11:15', end: '12:15' },
    { key: '4', label: 'Period 4', start: '12:15', end: '13:15' },
    { key: 'lunch', label: 'Lunch', start: '13:15', end: '14:00' },
    { key: '5', label: 'Period 5', start: '14:00', end: '15:00' }
  ];

  // Wednesday: form runs long for PSHCE, so period 3 onwards starts at 11:20
  var WEDNESDAY = [
    { key: '1', label: 'Period 1', start: '08:30', end: '09:30' },
    { key: '2', label: 'Period 2', start: '09:30', end: '10:30' },
    { key: 'form', label: 'Form / PSHCE', start: '10:30', end: '11:20' },
    { key: '3', label: 'Period 3', start: '11:20', end: '12:20' },
    { key: '4', label: 'Period 4', start: '12:20', end: '13:20' },
    { key: 'lunch', label: 'Lunch', start: '13:20', end: '14:00' },
    { key: '5', label: 'Period 5', start: '14:00', end: '15:00' }
  ];

  // The maths corridor. Top side 66-69, bottom side 60-64 with 60 at the
  // right-hand end. There is no room 65.
  var CORRIDOR_TOP = ['69', '68', '67', '66'];
  var CORRIDOR_BOTTOM = ['64', '63', '62', '61', '60'];
  // Maths rooms elsewhere in school, in rough order of how much they're used
  var ELSEWHERE = ['W7', '11', '09', '63p'];

  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
                    Thu: 'Thursday', Fri: 'Friday' };

  var data = null;
  var state = { day: null, slotIdx: null, week: null, live: true };

  // ---------- date helpers ----------
  function d(str) { return new Date(str + 'T00:00:00'); }

  function mondayOf(dt) {
    var day = dt.getDay();
    var m = new Date(dt);
    m.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
    m.setHours(0, 0, 0, 0);
    return m;
  }

  function iso(dt) {
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  function termFor(dt) {
    for (var i = 0; i < TERM_BLOCKS.length; i++) {
      if (dt >= d(TERM_BLOCKS[i][1]) && dt <= d(TERM_BLOCKS[i][2])) {
        return TERM_BLOCKS[i][0];
      }
    }
    return null;
  }

  function weekNumber(dt) {
    var diff = Math.round((mondayOf(dt) - mondayOf(d(WEEK1_MONDAY))) / 604800000);
    return ((diff % 2) + 2) % 2 === 0 ? 1 : 2;
  }

  function minutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function slotsFor(day) { return day === 'Wed' ? WEDNESDAY : STANDARD; }

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------- lookups ----------
  function lessonsAt(week, day, periodKey) {
    if (!data || !/^[1-5]$/.test(periodKey)) return [];
    var wk = data.weeks[String(week)];
    if (!wk || !wk[day]) return [];
    return wk[day][periodKey] || [];
  }

  function byRoom(week, day, periodKey) {
    var map = {};
    lessonsAt(week, day, periodKey).forEach(function (e) {
      var r = e.room || '?';
      (map[r] = map[r] || []).push(e);
    });
    return map;
  }

  function teacherName(code) {
    return (data.teachers && data.teachers[code]) || code;
  }

  function yearClass(year) {
    if (year === 12 || year === 13) return 'ks5';
    if (year === 7) return 'y7';
    if (year === 8) return 'y8';
    if (year === 9) return 'y9';
    if (year === 10) return 'y10';
    if (year === 11) return 'y11';
    return 'other';
  }

  // ---------- render ----------
  function roomHTML(room, lessons) {
    if (!lessons || !lessons.length) {
      return '<div class="room room-free"><span class="room-no">' + esc(room) +
        '</span><span class="room-empty">Free</span></div>';
    }
    var body = lessons.map(function (e) {
      return '<span class="room-class ' + yearClass(e.year) + '">' + esc(e.klass) + '</span>' +
        '<span class="room-teacher">' + esc(teacherName(e.teacher)) + '</span>';
    }).join('');
    var cls = yearClass(lessons[0].year);
    return '<div class="room room-busy room-' + cls + '"><span class="room-no">' +
      esc(room) + '</span>' + body + '</div>';
  }

  function render() {
    var now = new Date();
    var today = new Date(now);
    today.setHours(0, 0, 0, 0);

    var dayIdx = now.getDay() - 1;         // 0 = Mon
    var isWeekday = dayIdx >= 0 && dayIdx <= 4;

    // On a weekend the "live" view previews the coming Monday, so the
    // term check, closures and Week 1/2 must all be worked out for THAT day.
    var ref = new Date(today);
    if (!isWeekday) ref.setDate(ref.getDate() + (now.getDay() === 6 ? 2 : 1));
    var term = termFor(ref);
    var closed = CLOSURES.indexOf(iso(ref)) !== -1;

    // If the user hasn't picked anything, follow the clock
    if (state.live) {
      state.day = isWeekday ? DAYS[dayIdx] : 'Mon';
      state.week = weekNumber(ref);
      var slots = slotsFor(state.day);
      var mins = now.getHours() * 60 + now.getMinutes();
      state.slotIdx = 0;
      if (isWeekday) {
        for (var i = 0; i < slots.length; i++) {
          if (mins >= minutes(slots[i].start)) state.slotIdx = i;
        }
      }
    }

    var day = state.day, week = state.week, slots = slotsFor(day);
    var slot = slots[state.slotIdx];

    // ---- status banner ----
    var statusEl = document.getElementById('tt-status');
    var gridEl = document.getElementById('tt-grid');

    if (!term || closed) {
      statusEl.className = 'tt-status tt-status-off';
      statusEl.innerHTML = '<strong>No lessons ' + (isWeekday ? 'this week' : 'on Monday') + '.</strong> ' +
        (closed ? 'School is closed ' + (isWeekday ? 'today' : 'on Monday') + '.'
                : 'It\'s the school holidays — enjoy it.');
      gridEl.style.display = 'none';
      document.getElementById('tt-controls').style.display = 'none';
      return;
    }
    gridEl.style.display = '';
    document.getElementById('tt-controls').style.display = '';

    var liveNote = '';
    if (state.live && isWeekday) {
      var mins2 = now.getHours() * 60 + now.getMinutes();
      if (mins2 < minutes(slots[0].start)) liveNote = 'Before school';
      else if (mins2 >= minutes(slots[slots.length - 1].end)) liveNote = 'After school';
      else liveNote = 'Happening now';
    } else if (state.live) {
      liveNote = 'Weekend — no lessons today · preview of Monday ' +
        ref.getDate() + ' ' + ref.toLocaleDateString('en-GB', { month: 'short' });
    }

    statusEl.className = 'tt-status';
    statusEl.innerHTML =
      '<span class="tt-live">' + esc(liveNote || 'Browsing') + '</span>' +
      '<strong>' + esc(DAY_NAMES[day]) + ' &middot; Week ' + week + ' &middot; ' +
      esc(slot.label) + '</strong>' +
      '<span class="tt-time">' + slot.start + '&ndash;' + slot.end + ' &middot; ' + esc(term) + '</span>';

    // ---- controls ----
    var daySel = document.getElementById('tt-day');
    var weekSel = document.getElementById('tt-week');
    var slotWrap = document.getElementById('tt-slots');
    if (daySel.value !== day) daySel.value = day;
    if (weekSel.value !== String(week)) weekSel.value = String(week);

    slotWrap.innerHTML = '';
    slots.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-slot-btn' + (i === state.slotIdx ? ' active' : '') +
        (s.key === 'form' || s.key === 'lunch' ? ' tt-slot-break' : '');
      b.innerHTML = '<span>' + esc(s.label.replace('Period ', 'P')) + '</span><small>' + s.start + '</small>';
      b.addEventListener('click', function () {
        state.live = false; state.slotIdx = i; render();
      });
      slotWrap.appendChild(b);
    });

    // ---- the corridor ----
    if (slot.key === 'form' || slot.key === 'lunch') {
      gridEl.innerHTML = '<div class="tt-break-msg">' +
        (slot.key === 'lunch' ? '&#127869; Lunch' : '&#128196; ' + slot.label) +
        ' &mdash; no lessons timetabled.</div>';
      return;
    }

    var map = byRoom(week, day, slot.key);
    var used = {};
    Object.keys(map).forEach(function (r) { used[r] = true; });

    function side(rooms) {
      return rooms.map(function (r) {
        delete used[r];
        return roomHTML(r, map[r]);
      }).join('');
    }

    var topHTML = side(CORRIDOR_TOP);
    var botHTML = side(CORRIDOR_BOTTOM);

    // Any other rooms in use this period
    var others = Object.keys(map).filter(function (r) { return used[r]; }).sort();
    var othersHTML = others.map(function (r) { return roomHTML(r, map[r]); }).join('');

    gridEl.innerHTML =
      '<div class="corridor">' +
        '<div class="corridor-side corridor-top">' + topHTML + '</div>' +
        '<div class="corridor-hall"><span>Maths corridor</span></div>' +
        '<div class="corridor-side corridor-bottom">' + botHTML + '</div>' +
      '</div>' +
      (othersHTML
        ? '<h3 class="tt-elsewhere-title">Maths lessons elsewhere in school</h3>' +
          '<div class="tt-elsewhere">' + othersHTML + '</div>'
        : '');
  }

  // ---------- init ----------
  function init() {
    var daySel = document.getElementById('tt-day');
    DAYS.forEach(function (dd) {
      var o = document.createElement('option');
      o.value = dd; o.textContent = DAY_NAMES[dd];
      daySel.appendChild(o);
    });
    daySel.addEventListener('change', function () {
      state.live = false; state.day = this.value;
      if (state.slotIdx >= slotsFor(state.day).length) state.slotIdx = 0;
      render();
    });
    document.getElementById('tt-week').addEventListener('change', function () {
      state.live = false; state.week = parseInt(this.value, 10); render();
    });
    document.getElementById('tt-now').addEventListener('click', function () {
      state.live = true; render();
    });

    fetch('data/timetable.json?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (json) { data = json; render(); })
      .catch(function (err) {
        document.getElementById('tt-status').textContent =
          'Could not load the timetable data.';
        console.error('timetable:', err);
      });

    // keep the clock honest without needing a refresh
    setInterval(function () { if (state.live && data) render(); }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
