import { redirect } from 'next/navigation'

export default function AdminMapPage() {
  redirect('/gateway/dashboard/?tab=map')
}
