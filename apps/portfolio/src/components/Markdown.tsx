import { Fragment, type ReactNode } from 'react';
import { parseMarkdown, type Inline } from '../lib/markdown';
import { Link } from '../app/router';

/** Text written in the dashboard, rendered as elements (never as raw HTML). */
function renderInline(nodes: Inline[], keyPrefix = ''): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'br':
        return <br key={key} />;
      case 'code':
        return <code key={key}>{node.text}</code>;
      case 'strong':
        return <strong key={key}>{renderInline(node.children, `${key}-`)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(node.children, `${key}-`)}</em>;
      case 'link':
        return node.href.startsWith('/') ? (
          <Link key={key} href={node.href}>
            {renderInline(node.children, `${key}-`)}
          </Link>
        ) : (
          <a key={key} href={node.href} rel="noopener noreferrer" target="_blank">
            {renderInline(node.children, `${key}-`)}
          </a>
        );
    }
  });
}

export function Markdown({ source, className = 'prose' }: { source: string; className?: string }) {
  if (!source.trim()) return null;
  return (
    <div className={className}>
      {parseMarkdown(source).map((block, index) => {
        switch (block.type) {
          case 'p':
            return <p key={index}>{renderInline(block.children)}</p>;
          case 'h':
            return block.level === 3 ? (
              <h3 key={index}>{renderInline(block.children)}</h3>
            ) : (
              <h4 key={index}>{renderInline(block.children)}</h4>
            );
          case 'ul':
          case 'ol': {
            const List = block.type;
            return (
              <List key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </List>
            );
          }
          case 'quote':
            return <blockquote key={index}>{renderInline(block.children)}</blockquote>;
          case 'code':
            return (
              <pre key={index}>
                <code>{block.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
