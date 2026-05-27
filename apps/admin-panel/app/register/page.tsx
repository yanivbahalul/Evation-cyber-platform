import RegisterPage from '@/features/auth/components/RegisterPage'
import { AuthProvider } from '@/features/auth/context/AuthContext'

export default function Page() {
  return (
    <AuthProvider>
      <RegisterPage />
    </AuthProvider>
  )
}

