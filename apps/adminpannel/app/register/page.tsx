import RegisterPage from '@/components/dashboard/RegisterPage'
import { AuthProvider } from '@/context/AuthContext'

export default function Page() {
  return (
    <AuthProvider>
      <RegisterPage />
    </AuthProvider>
  )
}

