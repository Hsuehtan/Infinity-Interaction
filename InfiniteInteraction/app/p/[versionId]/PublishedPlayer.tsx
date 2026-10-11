'use client';
import {useEffect,useRef} from 'react';
import {useRuntimeSessionStore} from '../../_features/runtime-session/store';
import {usePlayerStore} from '../../_store/usePlayerStore';
import PlayerOverlay from '../../_components/player/PlayerOverlay';
import type {PlaybackSnapshot} from '../../../shared/publishing';
export default function PublishedPlayer({snapshot}:{snapshot:PlaybackSnapshot}){
  const startButton=useRef<HTMLButtonElement>(null);
  const playing=usePlayerStore(state=>state.isPlaying);
  useEffect(()=>()=>{useRuntimeSessionStore.getState().stop();usePlayerStore.getState().reset();},[]);
  useEffect(()=>{if(!playing)startButton.current?.focus();},[playing]);
  const start=()=>{usePlayerStore.getState().reset();usePlayerStore.getState().setIsPlaying(true);useRuntimeSessionStore.getState().start(snapshot.graph);};
  return <main><section className="published-landing" inert={playing} aria-hidden={playing}><h1>{snapshot.title}</h1><p>点击开始体验。作品包含视频与声音。</p><button ref={startButton} className="primary" onClick={start} disabled={playing}>开始体验</button><small>由 Infinite Interaction 制作 · 基于 OpenFMV</small></section><PlayerOverlay aspectRatio={snapshot.ratio==='9:16'?9/16:snapshot.ratio==='1:1'?1:16/9}/></main>;
}
