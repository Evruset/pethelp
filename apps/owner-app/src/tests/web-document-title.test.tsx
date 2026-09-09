import RootHtml, { OWNER_WEB_DOCUMENT_TITLE } from '@/app/+html';

it('provides a deterministic non-empty Owner Web document title', () => {
  expect(OWNER_WEB_DOCUMENT_TITLE).toBe('VetHelp');

  const html = RootHtml({ children: null });
  const head = html.props.children[0];
  const title = head.props.children.find((child: { type?: unknown }) => child?.type === 'title');

  expect(title).toBeDefined();
  expect(title.props.children).toBe(OWNER_WEB_DOCUMENT_TITLE);
  expect(title.props.children.trim()).not.toBe('');
});
