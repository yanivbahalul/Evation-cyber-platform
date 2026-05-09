'use client'

import { useState } from 'react'
import Sidebar, { type ActiveTab } from './Sidebar'
import TopBar from './TopBar'
import ThreatMap from './ThreatMap'
import AttackEventsTable from './AttackEventsTable'
import AttackerProfiles from './AttackerProfiles'
import HoneyTokenPanel from './HoneyTokenPanel'
import AdminUsersPanel from './AdminUsersPanel'

/**
 * Dashboard — protected SPA shell.
 * Renders after successful 2FA. Uses Context API for state.
 * The /admin/map and /admin/ban routes are protected server-side
 * via the JWT cookie middleware.
 */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={activeTab} onSelect={setActiveTab} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar active={activeTab} />

        <div className="flex-1 overflow-auto p-5">
          {activeTab === 'map'      && <ThreatMap />}
          {activeTab === 'events'   && <AttackEventsTable />}
          {activeTab === 'profiles' && <AttackerProfiles />}
          {activeTab === 'tokens'   && <HoneyTokenPanel />}
          {activeTab === 'adminUsers' && <AdminUsersPanel />}
        </div>
      </main>
    </div>
  )
}
