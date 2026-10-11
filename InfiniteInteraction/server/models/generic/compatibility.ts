import type {PoolClient} from 'pg';
import {database} from '../../db';
import {modelSql,providerSql,runtime,status,type ModelRow,type ProviderRow} from './service';
/** Legacy clients may read current metadata, but cannot reinterpret a managed protocol. */
export async function managedStatuses(client:Pick<PoolClient,'query'>=database()){
 const {rows}=await client.query<ModelRow>(modelSql);const ps=(await client.query<ProviderRow>(providerSql)).rows,rt=await runtime(client);
 return new Map(rows.map(m=>[m.id,status(m,ps.find(p=>p.id===m.provider_id)!,rt,m.output_kind)]));
}
