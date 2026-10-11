import type {ProviderConfig} from '../../../../shared/generic/contracts';

export const runningHubProviderId='ec75783a-bb8d-48d7-932e-962785c6f7dd';

export const runningHubProvider:ProviderConfig={
 name:'RunningHub',
 baseUrl:'https://www.runninghub.cn',
 auth:{type:'bearer',header:'Authorization'},
 headers:{},
 enabled:true,
 resultOrigins:[
  'https://rh-images-1252422369.cos.ap-beijing.myqcloud.com',
  'https://rh-images-switch-1252422369.cos.ap-guangzhou.myqcloud.com',
 ],
};
