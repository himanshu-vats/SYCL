import { useState } from 'react';
import SYCLDashboard from './components/SYCLDashboard.jsx';
import LandingPage from './components/LandingPage.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';

export default function App() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const path = window.location.pathname;
  const isRoot = path === '/' || path === '';

  return (
    <>
      {isRoot ? (
        <LandingPage />
      ) : (
        <SYCLDashboard onFeedback={() => setFeedbackOpen(true)} />
      )}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
