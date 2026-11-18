
// Audaro site JS: mobile nav + scroll reveal.
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }
  // Waitlist (Premium, coming soon): stored locally only, never sent anywhere.
  var wl = document.getElementById('waitlistForm');
  if (wl) {
    wl.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('waitlistEmail');
      var email = (input.value || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('waitlistMsg').textContent = 'Please enter a valid email address.';
        return;
      }
      try {
        var list = JSON.parse(localStorage.getItem('audaro_waitlist') || '[]');
        if (email) list.push({ email: email, at: new Date().toISOString() });
        localStorage.setItem('audaro_waitlist', JSON.stringify(list));
      } catch (err) { /* localStorage unavailable: still confirm */ }
      document.getElementById('waitlistMsg').textContent =
        'You are on the list — saved only on this device. Come back here at launch and this page will show you how to upgrade. No account created, nothing sent anywhere.';
      wl.reset();
    });
  }
});
