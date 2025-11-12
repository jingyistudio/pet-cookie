import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { Potrace } from 'potrace';
import { tmpdir } from 'os';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { image, threshold = 210, turdSize = 2, optCurve = true } = req.body || {};
    if (!image) return res.status(400).json({ error: 'image required' });

    // Node18 自带 fetch
    const r = await fetch(image);
    const buf = Buffer.from(await r.arrayBuffer());

    // 先二值化，确保黑白
    const bw = await sharp(buf).threshold(threshold).toBuffer();

    // 临时文件路径
    const id = crypto.randomBytes(8).toString('hex');
    const pngPath = join(tmpdir(), `${id}.png`);
    const svgPath = join(tmpdir(), `${id}.svg`);
    writeFileSync(pngPath, bw);

    // Potrace 生成 SVG
    await new Promise<void>((resolve, reject) => {
      new Potrace({ threshold, turdSize, optCurve })
        .trace(pngPath, (err: any, svg: string) => {
          if (err) return reject(err);
          writeFileSync(svgPath, svg);
          resolve();
        });
    });

    const svgData = readFileSync(svgPath, 'utf8');
    const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}`;
    res.status(200).json({ svgUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'trace failed' });
  }
}
