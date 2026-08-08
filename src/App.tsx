import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderBar } from './components/HeaderBar';
import { BottomNav } from './components/BottomNav';
import { PhoneFrame } from './components/PhoneFrame';
import { NotificationToast } from './components/NotificationToast';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ProfileModal } from './components/ProfileModal';
import { SupportModal } from './components/SupportModal';
import { AdminPartnerPortal } from './components/AdminPartnerPortal';
import { QrScannerModal } from './components/QrScannerModal';

import { GetStartedView } from './views/GetStartedView';
import { LoginPageView } from './views/LoginPageView';
import { HomeView } from './views/HomeView';
import { TurfBookingView } from './views/TurfBookingView';
import { FoodDhabaView } from './views/FoodDhabaView';
import { CelebrationsView } from './views/CelebrationsView';
import { MyBookingsView } from './views/MyBookingsView';

function MainApp() {
  const { theme, user } = useApp();
  const [appMode, setAppMode] = useState<'welcome' | 'login' | 'main'>('welcome');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedTurfId, setSelectedTurfId] = useState<string | undefined>(undefined);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  useEffect(() => {
    if (appMode === 'main' && !user.isLoggedIn) setAppMode('login');
  }, [appMode, user.isLoggedIn]);

  const handleSelectTurfFromHome = (turfId: string) => {
    setSelectedTurfId(turfId);
    setActiveTab('turfs');
  };

  if (appMode === 'welcome') {
    return (
      <PhoneFrame>
        <GetStartedView
          onGetStarted={() => setAppMode('login')}
          onLogin={() => setAppMode('login')}
        />
      </PhoneFrame>
    );
  }

  if (appMode === 'login') {
    return (
      <PhoneFrame>
        <LoginPageView
          onLoginSuccess={() => setAppMode('main')}
          onBack={() => setAppMode('welcome')}
        />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className={`min-h-full flex flex-col font-sans antialiased relative transition-colors ${
        theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}>
        {/* Floating Notification Toast */}
        <NotificationToast />

        {/* Top Header Bar */}
        <HeaderBar
          activeTab={activeTab}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenNotifications={() => setIsNotifDrawerOpen(true)}
        />

        {/* Main View Content with Motion Page Transitions */}
        <main className="flex-1 w-full max-w-md mx-auto relative overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
            >
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
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Fixed Mobile Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenQuickScan={() => setIsQrScannerOpen(true)}
        />

        {/* Modals & Drawers */}
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onOpenSupport={() => setIsSupportOpen(true)}
          onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setIsProfileOpen(false);
          }}
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
