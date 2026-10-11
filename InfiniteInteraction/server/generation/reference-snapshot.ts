import {createHash} from 'node:crypto';
import type {ProjectDocument} from '../../app/infinite/model';
import {isCompleteReference} from '../../shared/references';
import type {ReferenceSelection,ReferenceSnapshotItem} from '../../shared/generation-reference-snapshot';
import {requireCondition} from '../errors';

function fingerprint(reference:{category:string;name:string;description:string;assetIds:string[]}){
  return createHash('sha256').update(JSON.stringify({category:reference.category,name:reference.name,description:reference.description,assetIds:reference.assetIds})).digest('hex');
}
/** Freezes only explicitly chosen files. Relation edges and unselected files never enter a generation request. */
export function freezeReferenceSelections(document:ProjectDocument,selections:ReferenceSelection[],selectedAssets:Array<{assetId:string;refKey?:string}>):ReferenceSnapshotItem[]{
  const seen=new Set<string>();
  return selections.map(selection=>{
    const identity=`${selection.referenceId}:${selection.assetId}:${selection.refKey??''}`;
    requireCondition(!seen.has(identity),400,'REFERENCE_SELECTION_DUPLICATE','同一设定文件不能重复加入生成请求。');seen.add(identity);
    const reference=document.references.find(item=>item.id===selection.referenceId);
    requireCondition(reference&&isCompleteReference(reference)&&reference.assetIds.includes(selection.assetId)&&selectedAssets.some(item=>item.assetId===selection.assetId&&item.refKey===selection.refKey),409,'REFERENCE_SELECTION_CHANGED','设定或所选文件已变化，请重新选择。');
    return {...selection,category:reference.category,displayName:reference.name,fingerprint:fingerprint(reference)};
  });
}
