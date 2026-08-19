// Service worker deliberadamente mínimo.
//
// Só guarda em cache o que o Next publica com hash no nome (/_next/static/) e
// os ícones: esses arquivos são imutáveis, então servir da cache nunca entrega
// versão velha. HTML e respostas de API passam sempre pela rede — cachear
// página autenticada exibiria saldo desatualizado como se fosse o atual, que é
// pior do que não abrir.
//
// A cada deploy o CACHE muda de nome e o anterior é apagado no activate.
const CACHE = "fortuna-static-v1"
const CACHEABLE = [/^\/_next\/static\//, /^\/icons\//, /^\/fortuna-mark\.svg$/]

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!CACHEABLE.some((pattern) => pattern.test(url.pathname))) return

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
