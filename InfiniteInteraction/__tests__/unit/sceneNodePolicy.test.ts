import {describe, expect, it} from 'vitest';
import {isPlayableSceneNode} from '../../app/infinite/scene-node-policy';

describe('isPlayableSceneNode', () => {
  it('includes both the start scene and ordinary scenes', () => {
    expect([{type: 'start'}, {type: 'scene'}, {type: 'end'}].filter(isPlayableSceneNode)).toEqual([
      {type: 'start'},
      {type: 'scene'},
    ]);
  });
});
