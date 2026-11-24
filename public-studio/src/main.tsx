import React from 'react';
import {createRoot} from 'react-dom/client';
import PublicApp from './public-app';
import './globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<main className="authscreen">Opening Project Studio…</main>}><PublicApp/></React.Suspense></React.StrictMode>);
