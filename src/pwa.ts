import { registerSW } from 'virtual:pwa-register'

/**
 * Home-screen installs keep the previous app shell until the new service
 * worker takes over AND the page reloads. Check immediately on launch and
 * again whenever the app comes back to the foreground.
 */
registerSW({ immediate: true })

if (typeof document !== 'undefined' && 'serviceWorker' in navigator) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
  })
}
