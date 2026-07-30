import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderBar } from './components/HeaderBar';
import { BottomNav } from './components/BottomNav';
import { PhoneFrame } from './components/PhoneFrame';
import { NotificationToast } from './components/NotificationToast';
import { NotificationDrawer } from './components/NotificationDrawer';
import { OtpAuthModal } from './components/OtpAuthModal';
import { ProfileModal } from './components/ProfileModal';
import { SupportModal } from './components/SupportModal';
import { AdminPartnerPortal } from './components/AdminPartnerPortal';
import { QrScannerModal } from './components/QrScannerModal';

import { HomeView } from './views/HomeView';
import { TurfBookingView } from './views/TurfBookingView';
import { FoodDhabaView } from './views/FoodDhabaView';
import { CelebrationsView } from './views/CelebrationsView';
import { MyBookingsView } from './views/MyBookingsView';

function MainApp() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedTurfId, setSelectedTurfId] = useState<string | undefined>(undefined);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const handleSelectTurfFromHome = (turfId: string) => {
    setSelectedTurfId(turfId);
    setActiveTab('turfs');
  };

  return (
    <PhoneFrame>
      <div className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans antialiased relative">
        {/* Floating Notification Toast */}
        <NotificationToast />

        {/* Top Header Bar */}
        <HeaderBar
          activeTab={activeTab}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenNotifications={() => setIsNotifDrawerOpen(true)}
        />

        {/* Main View Content */}
        <main className="flex-1 w-full max-w-md mx-auto">
          {activeTab === 'home' && (
            <HomeView
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectTurf={handleSelectTurfFromHome}
            />
          )}

          {activeTab === 'turfs' && (
            <TurfBookingView
              selectedTurfId={selectedTurfId}
              onNavigateHub={() => setActiveTab('hub')}
            />
          )}

          {activeTab === 'food' && (
            <FoodDhabaView onNavigateHub={() => setActiveTab('hub')} />
          )}

          {activeTab === 'celebrations' && (
            <CelebrationsView onNavigateHub={() => setActiveTab('hub')} />
          )}

          {activeTab === 'hub' && <MyBookingsView />}
        </main>

        {/* Fixed Mobile Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenQuickScan={() => setIsQrScannerOpen(true)}
        />

        {/* Modals & Drawers */}
        <OtpAuthModal />
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onOpenSupport={() => setIsSupportOpen(true)}
          onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        />
        <NotificationDrawer isOpen={isNotifDrawerOpen} onClose={() => setIsNotifDrawerOpen(false)} />
        <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
        <AdminPartnerPortal isOpen={isAdminPortalOpen} onClose={() => setIsAdminPortalOpen(false)} />
        <QrScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      </div>
    </PhoneFrame>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
