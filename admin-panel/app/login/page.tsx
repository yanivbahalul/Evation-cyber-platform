import { redirect } from 'next/navigation'

/** Legacy URL — unified entry is /gateway/login */
export default function LoginRoute() {
  redirect('/gateway/login')
}
