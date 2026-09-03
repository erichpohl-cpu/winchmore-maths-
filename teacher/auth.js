/* auth.js — simple client-side gate for the teacher section.
   IMPORTANT: this is a convenience gate to keep the teacher tools out of
   students' way. It is NOT real security — on a static site the credentials
   live in the page source, so anyone determined can read them. Do not put
   anything genuinely confidential behind it. For real protection, host these
   pages behind a proper server login.

   Session lasts until the browser tab is closed (sessionStorage). */
(function () {
  "use strict";
  var USER = "admin";
  var PASS = "Winchmore1";
  var KEY  = "wm_teacher_ok";

  window.WM_AUTH = {
    isLoggedIn: function () { return sessionStorage.getItem(KEY) === "1"; },
    login: function (u, p) {
      if (u === USER && p === PASS) { sessionStorage.setItem(KEY, "1"); return true; }
      return false;
    },
    logout: function () { sessionStorage.removeItem(KEY); },
    /* Call at the top of a protected page. If not logged in, redirect to login. */
    guard: function (loginPath) {
      if (!this.isLoggedIn()) {
        var here = encodeURIComponent(location.pathname.split("/").pop() + location.hash);
        location.replace(loginPath + "?next=" + here);
      }
    }
  };
})();
