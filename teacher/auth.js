/* auth.js — the teacher section now signs in through the DNEP Lesson Planner (school Google account).
   There is no password on this site any more: the planner checks the @winchmore.enfield.sch.uk login,
   and its "Teacher links" tab opens the tools in this folder (trackers, faculty timetable).

   PLANNER_URL: the planner web app link. If you paste the new planner code into the existing
   "Teacher Planner Interactive" Apps Script project and deploy a new version, this link stays the same. */
(function () {
  "use strict";
  var PLANNER_URL = "https://script.google.com/a/macros/winchmore.enfield.sch.uk/s/AKfycbxL3dyPR2Lob1NSX59WW9OFMApS46Z_HfO99BMjfKUgmSM8mJgC6nsSu0dJWnIyxHQbyw/exec";
  window.WM_AUTH = {
    plannerUrl: PLANNER_URL,
    isLoggedIn: function () { return true; },
    login: function () { return true; },
    logout: function () {},
    guard: function () {}   // pages stay open; the planner is the way in
  };
})();
