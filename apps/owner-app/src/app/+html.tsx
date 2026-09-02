import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT } from '@/server/canonical-local-owner-origin';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>VetHelp — запись к ветеринару</title>
        <script dangerouslySetInnerHTML={{ __html: CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
