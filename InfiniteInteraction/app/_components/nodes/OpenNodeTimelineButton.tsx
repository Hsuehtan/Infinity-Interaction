import React from 'react';
import { Film } from 'lucide-react';
import { useEditorStore } from '../../_store/useEditorStore';
export function useOpenNodeTimeline(nodeId: string) {
  return React.useCallback((event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (event && (event.shiftKey || event.metaKey || event.ctrlKey)) return;
    event?.preventDefault(); event?.stopPropagation();
    useEditorStore.getState().setSelectedNodeId(nodeId);
    window.dispatchEvent(new CustomEvent('interaction:open-scene', { detail: nodeId }));
  }, [nodeId]);
}
export default function OpenNodeTimelineButton({ nodeId }: { nodeId: string }) {
  const open = useOpenNodeTimeline(nodeId);
  return <button className="nodrag" type="button" onClick={open} aria-label="剪辑场景"><Film size={16} /></button>;
}
