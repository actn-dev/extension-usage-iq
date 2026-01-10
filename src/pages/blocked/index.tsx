import React from 'react';
import { createRoot } from 'react-dom/client';
import BlockedPage from './BlockedPage';
import '@pages/blocked/index.css';
import '@assets/styles/tailwind.css';

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Blocked page root element");
  const root = createRoot(rootContainer);
  root.render(<BlockedPage />);
}

init();
