'use client'

import { useState } from 'react'
import Sidebar, { type ActiveTab } from './Sidebar'
import TopBar from './TopBar'
import ThreatMap from './ThreatMap'
import AttackEventsTable from './AttackEventsTable'
import AttackerProfiles from './AttackerProfiles'
import AttackerWorkspace from '@/features/investigation/components/AttackerWorkspace'
import HoneyTokenPanel from './HoneyTokenPanel'
import AdminUsersPanel from './AdminUsersPanel'
import { InvestigationProvider } from '@/features/investigation/context/InvestigationContext'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map')

  const goInvestigate = () => setActiveTab('investigate')

  return (
    <InvestigationProvider onNavigateWorkspace={goInvestigate}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar active={activeTab} onSelect={setActiveTab} />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar active={activeTab} />

          <div className="flex-1 overflow-auto p-5">
            {activeTab === 'map' && <ThreatMap onNavigateInvestigate={goInvestigate} />}
            {activeTab === 'events' && <AttackEventsTable />}
            {activeTab === 'profiles' && (
              <AttackerProfiles onNavigateInvestigate={goInvestigate} />
            )}
            {activeTab === 'investigate' && <AttackerWorkspace />}
            {activeTab === 'tokens' && <HoneyTokenPanel />}
            {activeTab === 'adminUsers' && <AdminUsersPanel />}
          </div>
        </main>
      </div>
    </InvestigationProvider>
  )
}
