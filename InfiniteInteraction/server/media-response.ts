import {getMedia} from './storage';
import {requireCondition} from './errors';
export async function serveMedia(row:{storage_key:string;metadata:Record<string,unknown>},range:string|null,head=false,cacheControl='no-store',download=false){
  const size = Number(row.metadata.size);
  let interval: string|undefined;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] ? (match[2] ? Math.min(size-1, Number(match[2])) : size-1) : size-1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    interval = `bytes=${start}-${end}`;
  }
  const extension=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/mp4":"mp4"} as Record<string,string>)[String(row.metadata.mime)]??'bin';
  const headers: Record<string,string> = { 'Content-Type': String(row.metadata.mime), 'Cache-Control': cacheControl, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': download?`attachment; filename="asset.${extension}"`:'inline' };
  if (head) return new Response(null, { headers: { ...headers, 'Content-Length': String(size) } });
  const result = await getMedia(row.storage_key, interval);
  requireCondition(result.Body, 503, 'CONTENT_UNAVAILABLE', '素材暂时无法读取。');
  if (result.ContentLength != null) headers['Content-Length'] = String(result.ContentLength);
  if (result.ContentRange) headers['Content-Range'] = result.ContentRange;
  return new Response(result.Body.transformToWebStream() as ReadableStream<Uint8Array>, { status: interval ? 206 : 200, headers });
}
