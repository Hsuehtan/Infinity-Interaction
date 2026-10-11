import {database} from '../db';
import {requireCondition} from '../errors';
import {serveMedia} from '../media-response';
import {readArtifact} from './artifacts';
export async function publishedManifest(versionId:string){
  const {rows:[row]}=await database().query(`SELECT b.artifact_key,b.artifact_hash FROM published_versions v JOIN publish_builds b ON b.version_id=v.id
    WHERE v.id=$1 AND v.status='ready' AND b.status='succeeded' AND b.share_scope='unlisted'`,[versionId]);
  requireCondition(row,404,'PUBLICATION_NOT_FOUND','作品尚未发布或不存在。');
  const manifest=await readArtifact(row.artifact_key,row.artifact_hash);requireCondition(manifest.versionId===versionId,503,'ARTIFACT_UNAVAILABLE','作品文件校验失败。');return manifest;
}
export async function publishedAsset(versionId:string,assetId:string,range:string|null,head=false){
  const {rows:[row]}=await database().query(`SELECT a.storage_key,a.metadata FROM published_version_assets a JOIN published_versions v ON v.id=a.version_id JOIN publish_builds b ON b.version_id=v.id
    WHERE v.id=$1 AND a.asset_id=$2 AND v.status='ready' AND b.status='succeeded' AND b.share_scope='unlisted'`,[versionId,assetId]);
  requireCondition(row,404,'PUBLICATION_ASSET_NOT_FOUND','作品素材不存在。');
  return serveMedia(row,range,head,'public, max-age=300');
}
