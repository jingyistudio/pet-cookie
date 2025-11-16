import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { trace } from 'potrace';
import fetch from 'node-fetch';

// 把位图 buffer 转成 SVG 字符串
function bufferToSvg(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(
      buffer,
      {
        threshold: 200,  // 黑白分界阈值，可根据效果微调
        turdSize: 50,    // 去掉小杂点
      },
      (err, svg) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let imageBuffer: Buffer;

    // ① Coze / 其它服务用：POST 直接传图片（二进制）
    if (req.method === 'POST') {
      // @vercel/node 默认不会帮你解析多 part，这里假设 body 就是纯二进制
      if (!req.body) {
        return res.status(400).json({ error: 'No image in request body' });
      }

      if (Buffer.isBuffer(req.body)) {
        imageBuffer = req.body;
      } else if (typeof req.body === 'string') {
        // 如果以后你用 base64 字符串，也可以在这里解码
        imageBuffer = Buffer.from(req.body, 'base64');
      } else {
        return res
          .status(400)
          .json({ error: 'POST body must be raw binary or base64 string' });
      }

    // ② 浏览器 / Shopify 用：GET ?image=图片URL
    } else if (req.method === 'GET') {
      const imageUrl = req.query.image as string | undefined;
      if (!imageUrl) {
        return res.status(400).json({ error: 'Missing image query parameter "image"' });
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res
          .status(400)
          .json({ error: `Failed to fetch image: ${response.statusText}` });
      }

      const arrayBuf = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuf);

    } else {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 统一转成干净的 PNG（去透明，铺白底）
    const pngBuffer = await sharp(imageBuffer)
      .png()
      .flatten({ background: '#ffffff' })
      .toBuffer();

    const svg = await bufferToSvg(pngBuffer);

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('trace error', error);
    return res.status(500).json({
      error: 'Internal server error',
      detail: String(error?.message ?? error),
    });
  }
}
