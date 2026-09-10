'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar, { type ActiveTab } from './Sidebar'
import TopBar from './TopBar'
import ThreatMap from './ThreatMap'
import AttackEventsTable from './AttackEventsTable'
import AttackerProfiles from './AttackerProfiles'
import AttackerWorkspace from '@/features/investigation/components/AttackerWorkspace'
import HoneyTokenPanel from './HoneyTokenPanel'
import AdminUsersPanel from './AdminUsersPanel'
import BanManagementPanel from './BanManagementPanel'
import MaintenancePanel from './MaintenancePanel'
import Overview from './Overview'
import { InvestigationProvider } from '@/features/investigation/context/InvestigationContext'

const TAB_IDS: ActiveTab[] = ['overview', 'map', 'events', 'profiles', 'investigate', 'tokens', 'adminUsers', 'bans', 'maintenance']

function tabFromQuery(raw: string | null): ActiveTab {
  if (raw && TAB_IDS.includes(raw as ActiveTab)) return raw as ActiveTab
  return 'overview'
}

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => tabFromQuery(searchParams.get('tab')))

  useEffect(() => {
    setActiveTab(tabFromQuery(searchParams.get('tab')))
  }, [searchParams])

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab)
    router.push(`/gateway/dashboard/?tab=${tab}`)
  }

  const goInvestigate = () => selectTab('investigate')

  return (
    <InvestigationProvider onNavigateWorkspace={goInvestigate}>
      <div className="flex h-screen flex-col overflow-hidden bg-background lg:flex-row">
        <Sidebar active={activeTab} onSelect={selectTab} />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar active={activeTab} />

          <div className="flex-1 overflow-auto p-4 sm:p-6">
            {activeTab === 'overview' && <Overview onSelectTab={selectTab} />}
            {activeTab === 'map' && <ThreatMap onNavigateInvestigate={goInvestigate} />}
            {activeTab === 'events' && <AttackEventsTable />}
            {activeTab === 'profiles' && (
              <AttackerProfiles onNavigateInvestigate={goInvestigate} />
            )}
            {activeTab === 'investigate' && <AttackerWorkspace />}
            {activeTab === 'tokens' && <HoneyTokenPanel />}
            {activeTab === 'adminUsers' && <AdminUsersPanel />}
            {activeTab === 'bans' && <BanManagementPanel />}
            {activeTab === 'maintenance' && <MaintenancePanel />}
          </div>
        </main>
      </div>
    </InvestigationProvider>
  )
}
