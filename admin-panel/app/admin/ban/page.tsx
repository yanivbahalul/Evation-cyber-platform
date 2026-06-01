import { redirect } from 'next/navigation'

export default function AdminBanPage() {
  redirect('/gateway/dashboard/?tab=bans')
}
