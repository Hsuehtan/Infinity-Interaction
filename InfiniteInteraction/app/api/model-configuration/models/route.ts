import {configurationGet,configurationPost} from '@/server/models/generic/http';
import {models,saveModel} from '@/server/models/generic/service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=configurationGet(models);export const POST=configurationPost(saveModel);
