import { useState } from 'react';
import SYCLDashboard from './components/SYCLDashboard.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';

export default function App() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <>
      <SYCLDashboard onFeedback={() => setFeedbackOpen(true)} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
