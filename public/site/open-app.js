/* Nocta — someone already signed in on this device who types the address (or
 * taps a bookmark) wants the app, not the pitch: send them straight to /app/.
 * A plain script in the site's <head>, ahead of everything else, so the
 * marketing page never flashes first. Guests and new visitors stay here.
 *
 * The site still shows for a signed-in person when they ask for it: any
 * address with a query or hash (/?site, /#how), or a link from Nocta itself
 * (the site's own brand link, anything in /app/). */
(function () {
  try {
    if (location.search || location.hash) return;
    if (document.referrer.indexOf(location.origin + '/') === 0) return;
    // finished setup on this device (lib/store.jsx › ONBOARD_KEY) ...
    if (localStorage.getItem('nocta.onboarded.v1') !== '1') return;
    // ... with an account still signed in: Supabase's saved session, or the
    // mock sign-in when Supabase isn't configured (lib/auth.jsx)
    var signedIn = Boolean(localStorage.getItem('nocta.mockauth.v1'));
    for (var i = 0; !signedIn && i < localStorage.length; i++) {
      signedIn = /^sb-.+-auth-token$/.test(localStorage.key(i));
    }
    if (signedIn) location.replace('/app/');
  } catch (e) {
    /* storage blocked: just show the site */
  }
})();
