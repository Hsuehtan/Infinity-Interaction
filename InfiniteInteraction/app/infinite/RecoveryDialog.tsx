'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export default function RecoveryDialog({ data, onClose }: { data: string | null; onClose(): void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    setUrl(objectUrl);
    return () => { URL.revokeObjectURL(objectUrl); setUrl(null); };
  }, [data]);
  return <Dialog.Root open={data !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card">
      <Dialog.Title>导出恢复数据</Dialog.Title>
      <Dialog.Description>保存这份副本后再重新载入项目。下载不可用时，可以全选下方文本并复制保存。</Dialog.Description>
      <label>恢复数据（JSON）<textarea aria-label="恢复数据（JSON）" readOnly value={data ?? ''} rows={12} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} /></label>
      <footer>{url && <a className="primary" href={url} download="infinite-interaction-recovery.json">下载 JSON</a>}<Dialog.Close asChild><button>关闭</button></Dialog.Close></footer>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
