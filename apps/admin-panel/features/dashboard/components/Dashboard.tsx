'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Sidebar, { type ActiveTab } from './Sidebar'
import TopBar from './TopBar'
import ThreatMap from './ThreatMap'
import AttackEventsTable from './AttackEventsTable'
import AttackerProfiles from './AttackerProfiles'
import AttackerWorkspace from '@/features/investigation/components/AttackerWorkspace'
import HoneyTokenPanel from './HoneyTokenPanel'
import AdminUsersPanel from './AdminUsersPanel'
import BanManagementPanel from './BanManagementPanel'
import { InvestigationProvider } from '@/features/investigation/context/InvestigationContext'

const TAB_IDS: ActiveTab[] = ['map', 'events', 'profiles', 'investigate', 'tokens', 'adminUsers', 'bans']

function tabFromQuery(raw: string | null): ActiveTab {
  if (raw && TAB_IDS.includes(raw as ActiveTab)) return raw as ActiveTab
  return 'map'
}

export default function Dashboard() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => tabFromQuery(searchParams.get('tab')))

  useEffect(() => {
    setActiveTab(tabFromQuery(searchParams.get('tab')))
  }, [searchParams])

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
            {activeTab === 'bans' && <BanManagementPanel />}
          </div>
        </main>
      </div>
    </InvestigationProvider>
  )
}
