import { Analytics } from '@vercel/analytics/react';
import SYCLDashboard from './components/SYCLDashboard.jsx';
import LandingPage from './components/LandingPage.jsx';

export default function App() {
  const path = window.location.pathname;
  const isRoot = path === '/' || path === '';

  if (isRoot) return (
    <>
      <LandingPage />
      <Analytics />
    </>
  );

  return (
    <>
      <SYCLDashboard />
      <Analytics />
    </>
  );
}
