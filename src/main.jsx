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
import { initDataset } from './lib/dataset.js';

/* the CPAP card comes first (the device's import, else the demo year): the
 * data modules derive from it as they load, so the app is imported after.
 * Loading it is quiet — the "bringing in last night" sync only plays after
 * an actual import (store.saveCardImport). */
initDataset().then(async () => {
  const { App } = await import('./App.jsx');
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
