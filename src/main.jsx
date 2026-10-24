import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/onboarding.css';
import './styles/import.css';
import './styles/motion.css';
import './styles/desktop.css';
import './styles/ios27.css'; // iOS 27 kit geometry for the phone layout — loads last
import { initDataset } from './lib/dataset.js';
import { SIGNIN_POPUP, finishPopupSignIn } from './lib/authPopup.js';
import { isWearableTab, finishWearableTab } from './lib/wearables.js';

/* the sign-in popup (lib/authPopup.js): when Google or Microsoft sends it back
 * here, it only finishes the sign-in, tells the page that opened it, and
 * closes. The app itself is never drawn in it. */
const inPopup = window.name === SIGNIN_POPUP && /[?&#](code|error)=/.test(window.location.href);

/* the tab a wearable's approve screen sent back (lib/wearables.js): it reports
 * the result to the Nocta tab that started Connect, then closes.
 *
 * Otherwise the CPAP card comes first (the device's import, else the demo
 * year): the data modules derive from it as they load, so the app is imported
 * after. Loading it is quiet — the "bringing in last night" sync only plays
 * after an actual import (store.saveCardImport). */
if (inPopup) {
  finishPopupSignIn();
} else if (isWearableTab()) {
  finishWearableTab();
} else initDataset().then(async () => {
  const { App } = await import('./App.jsx');
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
