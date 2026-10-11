/** The gateway's image envelope, narrowed to the formats and size that this app can stage in memory. */
export function validVideoReferenceImage(metadata:Record<string,unknown>|null|undefined,expectedBytes:unknown){
  const bytes=Number(expectedBytes),width=metadata?.width,height=metadata?.height;
  return ['image/png','image/jpeg','image/webp'].includes(String(metadata?.mime??''))
    &&Number.isSafeInteger(bytes)&&bytes>0&&bytes<=8_000_000
    &&typeof width==='number'&&Number.isInteger(width)&&width>=256&&width<=5760
    &&typeof height==='number'&&Number.isInteger(height)&&height>=256&&height<=5760
    &&width/height>=0.4&&width/height<=2.5;
}
