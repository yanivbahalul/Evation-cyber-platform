export type HrTicketSource = 'profile_edit' | 'contact' | 'dashboard'
export type HrTicketStatus = 'open' | 'in_review' | 'closed'

export interface HrTicket {
  _id: string
  ticketId: string
  subject: string
  message: string
  source: HrTicketSource
  status: HrTicketStatus
  isSuspicious: boolean
  suspiciousReasons: string[]
  submittedBy: string | null
  submitterIp: string
  submitterUserAgent: string
  traceId: string | null
  createdAt: string
  updatedAt: string
}
