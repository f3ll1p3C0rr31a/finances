import { readFileSync } from "node:fs"

/**
 * Impede que um layout de widget use uma view que o RemoteViews não sabe
 * inflar. Quando isso acontece o Android não dá erro de compilação: o widget
 * simplesmente falha na hora de ser adicionado à tela inicial, com
 * "não foi possível adicionar o widget", e só se descobre no aparelho.
 *
 * A lista é a das classes anotadas com @RemoteView no framework. Vale para
 * minSdk 26; API 31+ acrescenta CheckBox, RadioButton e Switch.
 *
 *   node scripts/check-widget-layout.mjs
 */
const ALLOWED = new Set([
  "AdapterViewFlipper", "FrameLayout", "GridLayout", "GridView", "LinearLayout",
  "ListView", "RelativeLayout", "StackView", "ViewFlipper",
  "AnalogClock", "Button", "Chronometer", "ImageButton", "ImageView",
  "ProgressBar", "TextView", "ViewStub",
])

const LAYOUTS = ["android/app/src/main/res/layout/widget_overview.xml"]

let failed = false

for (const path of LAYOUTS) {
  // Comentários saem antes: um <View> citado em comentário não é um <View>.
  const xml = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "")
  const tags = [...xml.matchAll(/<([A-Za-z][\w.]*)/g)].map((m) => m[1])

  for (const tag of new Set(tags)) {
    if (tag.includes(".")) {
      console.error(`FALHOU ${path}: <${tag}> — RemoteViews não infla view customizada`)
      failed = true
    } else if (!ALLOWED.has(tag)) {
      console.error(`FALHOU ${path}: <${tag}> não está na lista de views do RemoteViews`)
      failed = true
    }
  }

  // Atributo de tema é resolvido contra o tema da launcher, que não é o nosso.
  for (const match of xml.matchAll(/(\w+)="(\?[^"]+)"/g)) {
    console.error(`FALHOU ${path}: ${match[1]}="${match[2]}" — referência de tema não resolve na launcher`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log("layouts de widget ok")
