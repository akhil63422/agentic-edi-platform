import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { DocumentDetail } from '@/pages/DocumentDetail';
import Mapper from '@/pages/Mapper';
import Playground from '@/pages/Playground';
import { TradingPartners } from '@/pages/TradingPartners';
import { PartnerDetail } from '@/pages/PartnerDetail';
import { InboundEDI } from '@/pages/InboundEDI';
import { OutboundEDI } from '@/pages/OutboundEDI';
import { Exceptions } from '@/pages/Exceptions';
import { AuditLogs } from '@/pages/AuditLogs';
import { AuditLogDetail } from '@/pages/AuditLogDetail';
import { Settings } from '@/pages/Settings';
import { UserProfile } from '@/pages/UserProfile';
import { Analytics } from '@/pages/Analytics';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/document/:id/review" element={<DocumentDetail />} />
            <Route path="/mapper" element={<Mapper />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/inbound" element={<InboundEDI />} />
            <Route path="/outbound" element={<OutboundEDI />} />
            <Route path="/exceptions" element={<Exceptions />} />
            <Route path="/partners" element={<TradingPartners />} />
            <Route path="/partners/:id" element={<PartnerDetail />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/audit/:id" element={<AuditLogDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
