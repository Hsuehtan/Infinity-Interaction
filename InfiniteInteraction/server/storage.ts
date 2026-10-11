import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
let instance: S3Client | undefined;
function configuration(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function storage() {
  return instance ??= new S3Client({
    endpoint: configuration('S3_ENDPOINT'), region: configuration('S3_REGION'), forcePathStyle: true,
    credentials: { accessKeyId: configuration('S3_ACCESS_KEY_ID'), secretAccessKey: configuration('S3_SECRET_ACCESS_KEY') },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  });
}
const bucket = () => configuration('S3_BUCKET');
export async function putMedia(key: string, file: string, size: number) {
  await storage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: createReadStream(file), ContentLength: size, ContentType: 'application/octet-stream' }), { abortSignal: AbortSignal.timeout(120_000) });
}
/** First successful result bytes win; a resumed worker cannot overwrite an existing generated asset. */
export async function putMediaOnce(key:string,file:string,size:number){
  await storage().send(new PutObjectCommand({Bucket:bucket(),Key:key,Body:createReadStream(file),ContentLength:size,ContentType:'application/octet-stream',IfNoneMatch:'*'}),{abortSignal:AbortSignal.timeout(120_000)});
}
export function getMedia(key: string, range?: string, signal=AbortSignal.timeout(120_000)) {
  return storage().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range }), { abortSignal: signal });
}
export function putArtifact(key:string,bytes:Uint8Array,signal:AbortSignal){
  return storage().send(new PutObjectCommand({Bucket:bucket(),Key:key,Body:bytes,ContentLength:bytes.length,ContentType:'application/json'}),{abortSignal:signal});
}
export function headMedia(key: string, signal: AbortSignal) {
  return storage().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: signal });
}
export async function deleteMedia(key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: AbortSignal.timeout(30_000) });
}
