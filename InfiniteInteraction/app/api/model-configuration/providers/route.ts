import {configurationGet,configurationPost} from '@/server/models/generic/http';
import {providers,saveProvider} from '@/server/models/generic/service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=configurationGet(providers);export const POST=configurationPost(saveProvider);
