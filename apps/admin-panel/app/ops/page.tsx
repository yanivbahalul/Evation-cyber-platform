import { redirect } from 'next/navigation'

/** Legacy URL — same dashboard for all roles */
export default function OpsRedirect() {
  redirect('/gateway/workspace/')
}
