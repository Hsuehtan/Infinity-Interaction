import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { database } from './db';
import { type AssetRow, mediaLimits } from './assets';
import { getMedia } from './storage';
import { probeMedia } from './media-probe';
import { AppError, requireCondition } from './errors';
export async function processNextMedia() {
  const token = randomUUID();
  const { rows: [asset] } = await database().query<AssetRow>(`UPDATE assets SET lease_token=$1,lease_until=now()+interval '5 minutes',attempts=attempts+1
    WHERE id=(SELECT id FROM assets WHERE status='processing' AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [token]);
  if (!asset) return false;
  const dir = await mkdtemp(join(tmpdir(), 'interaction-probe-')), file = join(dir,'media');
  try {
    const object = await getMedia(asset.storage_key);
    requireCondition(object.Body, 503, 'OBJECT_MISSING', '已上传文件暂时不可读取。');
    let bytes = 0;
    const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; callback(bytes > mediaLimits().maxBytes ? new AppError(413,'FILE_TOO_LARGE','文件超过大小限制。') : null, chunk); } });
    await pipeline(object.Body as never, limiter, createWriteStream(file, { flags: 'wx' }), { signal: AbortSignal.timeout(120_000) });
    requireCondition(bytes === Number(asset.expected_bytes), 415, 'SIZE_MISMATCH', '存储文件不完整。');
    let metadata;
    try { metadata = await probeMedia(file, asset.type, bytes); }
    catch (error) { if (error instanceof AppError) throw error; throw new AppError(415, 'INVALID_MEDIA', '文件损坏或无法识别，请上传受支持的媒体文件。'); }
    await database().query("UPDATE assets SET status='ready',metadata=$3,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND status='processing' AND lease_token=$2", [asset.id, token, metadata]);
  } catch (error) {
    const permanent = error instanceof AppError && error.status < 500;
    await database().query(`UPDATE assets SET status=$3,error=$4,lease_token=NULL,lease_until=now()+interval '30 seconds',updated_at=now() WHERE id=$1 AND status='processing' AND lease_token=$2`, [asset.id, token, permanent || asset.attempts >= 5 ? 'failed' : 'processing', permanent ? error.message : '文件读取暂时失败，正在重试。']);
  } finally { await rm(dir, { recursive: true, force: true }); }
  return true;
}
