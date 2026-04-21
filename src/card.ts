import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { get } from 'node:https'
import type { WrappedData } from './types.js'
import { buildCard } from './card-template.js'

const FONT_URL = 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf'
const CACHE_DIR = join(homedir(), '.claude-wrapped')
const FONT_CACHE = join(CACHE_DIR, 'NotoSansSC-Regular.ttf')

/** 下载字体并缓存到本地，后续直接读缓存 */
async function loadFont(): Promise<Buffer> {
  if (existsSync(FONT_CACHE)) {
    return readFileSync(FONT_CACHE)
  }

  console.log('  首次运行，正在下载中文字体（~10MB）...')
  mkdirSync(CACHE_DIR, { recursive: true })

  const data = await new Promise<Buffer>((resolve, reject) => {
    get(FONT_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`字体下载失败: HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })

  writeFileSync(FONT_CACHE, data)
  return data
}

export async function generateCard(data: WrappedData): Promise<void> {
  const fontData = await loadFont()

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
