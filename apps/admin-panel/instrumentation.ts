export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startupLog } = await import('@evation/shared-utils')
  startupLog.logServiceReady('admin-panel')
}
