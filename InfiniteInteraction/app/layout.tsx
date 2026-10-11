import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/zh-CN.json';
import '@xyflow/react/dist/style.css';
import './globals.css';
import './infinite/workbench.css';
export const metadata: Metadata = { title: 'Infinite Interaction', description: '互动视频创作工作台', icons: { icon: '/logo.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" className="dark"><body><NextIntlClientProvider locale="zh-CN" messages={messages}>{children}</NextIntlClientProvider></body></html>;
}
