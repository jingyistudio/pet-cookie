import { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { trace } from 'potrace';
import fetch from 'node-fetch';

// 将输入的图片 URL 转为 SVG 线稿
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const imageUrl = req.query.image as string;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing image parameter' });
    }

    // 获取远程图片
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 压缩为灰度图
    const gray = await sharp(buffer).resize(512).greyscale().toBuffer();

    // 转为 SVG
    trace(gray, (err: any, svg: string) => {
      if (err) throw err;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.status(200).send(svg);
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}
