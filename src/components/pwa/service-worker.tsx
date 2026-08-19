"use client"

import { useEffect } from "react"

/**
 * Registra o service worker, que é o que torna o app instalável de verdade na
 * tela inicial (e o que o TWA espera encontrar). O cache é deliberadamente
 * conservador — ver `public/sw.js`.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
