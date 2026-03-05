import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import Transcripts from './pages/Transcripts';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Toaster
        position="top-left"
        reverseOrder={true}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'inherit',
            direction: 'rtl'
          }
        }}
      />
      
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/files" element={<Files />} />
        <Route path="/transcripts" element={<Transcripts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;
