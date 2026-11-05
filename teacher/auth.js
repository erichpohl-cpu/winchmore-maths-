/* auth.js — the teacher section is reached through the DNEP Lesson Planner.

   The planner checks the @winchmore.enfield.sch.uk Google login. These pages
   are then opened FROM the planner, and this file turns anyone else away:
   a visitor who types the address straight into the bar gets a "open this
   from the planner" screen instead of the page.

   A visit counts as coming from the planner when either
     * the browser says the previous page was script.google.com  (normal route), or
     * the address ends in  ?k=<ENTRY_KEY>  (use this in the planner's links if
       your browser strips the referrer -- e.g. timetable.html?k=wm-maths-2026)
   Once allowed, the tab is remembered, so moving between these pages works.

   IMPORTANT, please read: this is a deterrent, not real security. Every file
   on a GitHub Pages site is public to anyone who knows its address, and this
   check runs in the visitor's own browser, so it can be bypassed by turning
   JavaScript off. It keeps students and passers-by out. It does NOT make the
   pages private. The only way to make them genuinely staff-only is to serve
   them from the planner's Apps Script project, where Google enforces the
   school domain. Do not put anything confidential on these pages. */
(function () {
  "use strict";
  var PLANNER_URL = "https://script.google.com/a/macros/winchmore.enfield.sch.uk/s/AKfycbxL3dyPR2Lob1NSX59WW9OFMApS46Z_HfO99BMjfKUgmSM8mJgC6nsSu0dJWnIyxHQbyw/exec";
  var ENTRY_KEY = "wm-maths-2026";
  var FLAG = "wm_from_planner";

  function remember() { try { sessionStorage.setItem(FLAG, "1"); } catch (e) {} }

  function cameFromPlanner() {
    try { if (sessionStorage.getItem(FLAG) === "1") return true; } catch (e) {}
    var ref = document.referrer || "";
    if (/^https:\/\/script\.google(usercontent)?\.com\//i.test(ref)) { remember(); return true; }
    if (location.search.indexOf("k=" + ENTRY_KEY) !== -1) { remember(); return true; }
    return false;
  }

  function blockPage() {
    var html =
      '<div style="font-family:Nunito,system-ui,sans-serif;background:#0B1F3A;color:#fff;' +
      'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;">' +
      '<div style="max-width:30rem;text-align:center;">' +
      '<h1 style="font-family:\'Space Grotesk\',sans-serif;font-size:1.5rem;margin:0 0 .8rem;">Staff area</h1>' +
      '<p style="color:rgba(255,255,255,.78);line-height:1.6;margin:0 0 1.4rem;">' +
      'Open this page from the <strong>Teacher Planner</strong>. It checks your ' +
      '@winchmore.enfield.sch.uk account before letting you through.</p>' +
      '<a href="' + PLANNER_URL + '" style="display:inline-block;background:#00C9A7;color:#06302a;' +
      'font-weight:700;text-decoration:none;padding:.6rem 1.4rem;border-radius:50px;">Go to the planner</a>' +
      '</div></div>';
    document.documentElement.innerHTML = "<head><meta charset=\"utf-8\"><title>Staff area</title></head><body>" + html + "</body>";
    document.documentElement.style.visibility = "visible";
  }

  window.WM_AUTH = {
    plannerUrl: PLANNER_URL,
    entryKey: ENTRY_KEY,
    isLoggedIn: cameFromPlanner,
    login: function () { return true; },
    logout: function () { try { sessionStorage.removeItem(FLAG); } catch (e) {} },

    /* Call at the top of a protected page, before the body is parsed. */
    guard: function () {
      if (cameFromPlanner()) { remember(); return; }
      // Hide immediately so the real page never flashes up, then swap it out.
      document.documentElement.style.visibility = "hidden";
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", blockPage);
      } else {
        blockPage();
      }
    }
  };
})();
