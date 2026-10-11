export const isPlayableSceneNode = (node: {type: string}) =>
  node.type === 'start' || node.type === 'scene';
