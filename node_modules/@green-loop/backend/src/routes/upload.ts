import { Router } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../lib/response.js';

const router = Router();

// POST /upload-url
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const bucket = process.env['S3_BUCKET'];
    const region = process.env['S3_REGION'] ?? 'us-east-1';
    const endpoint = process.env['S3_ENDPOINT'];
    const publicBaseUrl = process.env['S3_PUBLIC_URL'];

    if (!bucket) {
      sendError(res, 500, 'Storage not configured', undefined, req.requestId);
      return;
    }

    const key = `photos/${uuidv4()}.jpg`;

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = { region };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const s3 = new S3Client(clientConfig);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Build public URL
    const photoUrl = publicBaseUrl
      ? `${publicBaseUrl.replace(/\/$/, '')}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    sendSuccess(res, { uploadUrl, photoUrl }, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
