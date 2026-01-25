/**
 * PanelX V3.0.0 PRO - Client Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
