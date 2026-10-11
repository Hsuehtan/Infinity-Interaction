import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {strToU8,zipSync} from 'fflate';
import {provisionUser,type Actor} from '../../server/auth';
import {database} from '../../server/db';
import {commitProjectImport,previewProjectImport,readImportBackup} from '../../server/project-import';
import {deleteMedia} from '../../server/storage';
import {exportProjectArchive} from '../../server/project-export';

let owner:Actor,stranger:Actor;const importedIds:string[]=[];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"><rect width="64" height="36" fill="#123456"/></svg>';
const manifest=(assetPath='assets/frame.svg',nodeType='start')=>({schemaVersion:1,id:'legacy',title:'旧工程',graphData:{nodes:[{id:'start',type:nodeType,position:{x:0,y:0},data:{type:nodeType,title:'开场',bodyText:'保留正文',timeline:{version:2,duration:2,bookmarks:[],tracks:[{id:'visual',type:'media',name:'画面',clips:[{id:'clip',type:'image',name:'画面',startTime:0,duration:2,src:assetPath,assetId:'old-asset',enabled:true}]}]}}},{id:'end',type:'end',position:{x:300,y:0},data:{type:'end',title:'结局',bodyText:''}}],edges:[{id:'edge',source:'start',sourceHandle:'node:default',target:'end'}]},assets:[{id:'old-asset',type:'image',name:'frame.svg',path:assetPath,relativePath:assetPath,metadata:{width:64,height:36}}],metadata:{entryNodeId:'start',references:[{id:'hero',category:'person',name:'主角',description:'旧设定',assetIds:['old-asset']}]},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const archive=(value=manifest())=>zipSync({'legacy/project.openfmv.json':strToU8(JSON.stringify(value)),'legacy/assets/frame.svg':strToU8(svg)});

beforeAll(async()=>{owner=await provisionUser(`import-${randomUUID()}`,`Password-${randomUUID()}`);stranger=await provisionUser(`import-${randomUUID()}`,`Password-${randomUUID()}`);});
afterAll(async()=>{for(const id of importedIds){const rows=(await database().query('SELECT storage_key FROM assets WHERE project_id=$1',[id])).rows;await Promise.all(rows.map(row=>deleteMedia(row.storage_key)));await database().query('DELETE FROM assets WHERE project_id=$1',[id]);await database().query('DELETE FROM projects WHERE id=$1',[id]);}for(const actor of [owner,stranger].filter(Boolean))await database().query('DELETE FROM users WHERE id=$1',[actor.id]);await database().end();});

describe('旧 OpenFMV 工程导入',()=>{
  it('previews and imports a zip into a new project with remapped ready media and an owner-only original backup',async()=>{
    const source=archive(),report=previewProjectImport(source,'legacy.zip');
    expect(report).toMatchObject({title:'旧工程',format:'zip',scenes:2,edges:1,assets:1,canImport:true,issues:[]});
    const commandId=randomUUID(),first=await commitProjectImport(owner,source,'legacy.zip',commandId);importedIds.push(first.id);
    expect(first).toMatchObject({title:'旧工程',revision:0,importSourceName:'legacy.zip'});expect(first.assets).toHaveLength(1);expect(first.assets[0]).toMatchObject({type:'image',name:'frame.png',metadata:{width:64,height:36,mime:'image/png'}});
    expect(first.references).toEqual([{id:'hero',category:'person',name:'主角',description:'旧设定',assetIds:[first.assets[0].id]}]);
    expect(first.graph.nodes[0].data.timeline?.tracks[0].clips[0]).toMatchObject({assetId:first.assets[0].id,src:`/api/projects/${first.id}/assets/${first.assets[0].id}/content`});
    expect(await commitProjectImport(owner,source,'legacy.zip',commandId)).toMatchObject({id:first.id});
    expect(await readImportBackup(owner,first.id)).toMatchObject({name:'legacy.zip'});expect((await readImportBackup(owner,first.id)).bytes.equals(Buffer.from(source))).toBe(true);
    await expect(readImportBackup(stranger,first.id)).rejects.toMatchObject({status:404});
  });
  it('preserves unsupported gameplay as a read-only compatibility record and locates missing media',async()=>{
    const before=Number((await database().query('SELECT count(*) n FROM projects WHERE owner_id=$1',[owner.id])).rows[0].n);
    const unsupportedSource=strToU8(JSON.stringify({...manifest('data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),'combat'),assets:[{id:'old-asset',type:'image',name:'frame.svg',path:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')}]}));
    const unsupported=previewProjectImport(unsupportedSource,'unsupported.openfmv.json');
    expect(unsupported.canImport).toBe(true);expect(unsupported.issues).toContainEqual(expect.objectContaining({severity:'warning',code:'UNSUPPORTED_NODE',location:'graphData.nodes[0]'}));
    const preserved=await commitProjectImport(owner,unsupportedSource,'unsupported.openfmv.json',randomUUID());importedIds.push(preserved.id);
    expect(preserved.graph.nodes.map(node=>node.id)).toEqual(['end']);
    expect(preserved.importCompatibility).toEqual([expect.objectContaining({nodeId:'start',nodeType:'combat',location:'graphData.nodes[0]'})]);
    const missing=structuredClone(manifest());missing.assets=[];
    const missingSource=strToU8(JSON.stringify(missing)),missingReport=previewProjectImport(missingSource,'missing.openfmv.json');
    expect(missingReport.issues).toContainEqual(expect.objectContaining({code:'MISSING_ASSET',location:'graphData.nodes[0].data.timeline'}));
    expect(missingReport.relinks).toEqual([expect.objectContaining({assetId:'old-asset',type:'image'})]);
    const relinked=await commitProjectImport(owner,missingSource,'missing.openfmv.json',randomUUID(),new Map([['old-asset',{name:'replacement.svg',bytes:strToU8(svg)}]]));importedIds.push(relinked.id);
    expect(relinked.assets).toHaveLength(1);expect(relinked.graph.nodes[0].data.timeline?.tracks[0].clips[0]).toMatchObject({assetId:relinked.assets[0].id});
    expect(Number((await database().query('SELECT count(*) n FROM projects WHERE owner_id=$1',[owner.id])).rows[0].n)).toBe(before+2);
  });
  it('rejects archive traversal and rolls back when an archive asset is absent',async()=>{
    expect(()=>previewProjectImport(zipSync({'../project.openfmv.json':strToU8(JSON.stringify(manifest()))}),'unsafe.zip')).toThrowError(expect.objectContaining({code:'UNSAFE_ARCHIVE_PATH'}));
    const oversized=archive(),signature=Buffer.from([0x50,0x4b,0x01,0x02]),central=Buffer.from(oversized).indexOf(signature);expect(central).toBeGreaterThan(0);new DataView(oversized.buffer,oversized.byteOffset+central).setUint32(24,101*1024*1024,true);
    expect(()=>previewProjectImport(oversized,'oversized.zip')).toThrowError(expect.objectContaining({code:'ARCHIVE_ENTRY_TOO_LARGE'}));
    const source=zipSync({'legacy/project.openfmv.json':strToU8(JSON.stringify(manifest()))});
    const before=Number((await database().query('SELECT count(*) n FROM projects WHERE owner_id=$1',[owner.id])).rows[0].n);
    await expect(commitProjectImport(owner,source,'missing.zip',randomUUID())).rejects.toMatchObject({code:'IMPORT_BLOCKED'});
    expect(Number((await database().query('SELECT count(*) n FROM projects WHERE owner_id=$1',[owner.id])).rows[0].n)).toBe(before);
  });
  it('remaps versioned prop references and preserves historical other without silently dropping files',async()=>{
    const sourceManifest=manifest();
    sourceManifest.metadata.references=[
      {schemaVersion:2,id:'prop-one',category:'prop',name:'道具',description:'旧地图',assetIds:['old-asset'],details:{}},
      {id:'legacy-other',category:'other',name:'旧备注',description:'',assetIds:['old-asset']},
    ] as typeof sourceManifest.metadata.references;
    const withRelations={...sourceManifest,metadata:{...sourceManifest.metadata,referenceRelations:[{endpointLow:'legacy-other',endpointHigh:'prop-one'}]}};
    const source=archive(withRelations),imported=await commitProjectImport(owner,source,'references.zip',randomUUID());importedIds.push(imported.id);
    expect(imported.references).toEqual([
      {schemaVersion:2,id:'prop-one',category:'prop',name:'道具',description:'旧地图',assetIds:[imported.assets[0].id],details:{}},
      {id:'legacy-other',category:'other',name:'旧备注',description:'',assetIds:[imported.assets[0].id]},
    ]);
    await expect(exportProjectArchive(stranger,imported.id)).rejects.toMatchObject({status:404});
    const backup=await exportProjectArchive(owner,imported.id);
    expect(new TextDecoder().decode((await import('fflate')).unzipSync(backup)['project.openfmv.json'])).not.toContain('referenceRelations');
    const again=await commitProjectImport(owner,backup,'roundtrip.openfmv.zip',randomUUID());importedIds.push(again.id);
    expect(again.references.map(reference=>({...reference,assetIds:reference.assetIds.map(id=>id===again.assets[0].id?'mapped':id)}))).toEqual(imported.references.map(reference=>({...reference,assetIds:reference.assetIds.map(id=>id===imported.assets[0].id?'mapped':id)})));
    const broken=structuredClone(sourceManifest);broken.metadata.references[0].assetIds=['missing-reference-file'];
    expect(previewProjectImport(archive(broken),'broken-reference.zip').issues).toContainEqual(expect.objectContaining({code:'MISSING_REFERENCE_ASSET',location:'metadata.references[0]'}));
  });
});
