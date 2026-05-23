import { redirect } from 'next/navigation'

/** Public entry — InnoTech HR / Safe Zone (proxied gateway). */
export default function Home() {
  redirect('/gateway/')
}
