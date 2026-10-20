import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../styles/tokens.css';
import '../styles/global.css';
import { ABTestingApp } from './ABTestingApp';
import { seedABTestFixture } from './fixture';

seedABTestFixture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ABTestingApp />
  </StrictMode>,
);
