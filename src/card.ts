import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WrappedData } from './types.js'
import { buildCard } from './card-template.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function generateCard(data: WrappedData): Promise<void> {
  // 加载字体
  const fontPath = join(__dirname, '..', 'assets', 'NotoSansSC-Regular.ttf')
  const fontData = readFileSync(fontPath)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = buildCard(data) as any

  const svg = await satori(element, {
    width: 1080,
    height: 1920,
    fonts: [
      {
        name: 'Noto Sans SC',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Noto Sans SC',
        data: fontData,
        weight: 700,
        style: 'normal',
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1080 },
  })
  const png = resvg.render().asPng()

  const outPath = './claude-wrapped-card.png'
  writeFileSync(outPath, png)
}
