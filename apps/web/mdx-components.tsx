/**
 * mdx-components.tsx — REQUIRED by Next.js App Router for MDX support.
 *
 * Maps every Markdown/MDX element to a styled React component.
 * This is the single place to control the visual style of all MDX content
 * across the entire web app.
 *
 * To override styles for a specific page, pass `components` to the MDX
 * component: <MyPage components={{ h1: CustomH1 }} />
 */
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings
    h1: ({ children }) => (
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-10 mb-4 text-xl font-semibold text-gray-900">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-800">{children}</h3>
    ),

    // Body text
    p: ({ children }) => <p className="mb-5 leading-relaxed text-gray-600">{children}</p>,

    // Lists
    ul: ({ children }) => <ul className="mb-5 space-y-2 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2 pl-6">{children}</ol>,
    li: ({ children }) => (
      <li className="leading-relaxed text-gray-600 marker:text-primary-500">{children}</li>
    ),

    // Inline
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    em: ({ children }) => <em className="text-gray-700 italic">{children}</em>,

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        className="font-medium text-primary-600 underline underline-offset-2 hover:text-primary-800"
      >
        {children}
      </a>
    ),

    // Divider
    hr: () => <hr className="my-10 border-gray-200" />,

    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-primary-400 pl-5 text-gray-600 italic">
        {children}
      </blockquote>
    ),

    // Tables
    table: ({ children }) => (
      <div className="my-8 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b-2 border-gray-300 bg-gray-50">{children}</thead>
    ),
    tbody: ({ children }) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => <th className="px-4 py-3 font-semibold text-gray-900">{children}</th>,
    td: ({ children }) => <td className="px-4 py-3 text-gray-600">{children}</td>,

    // Spread custom overrides last so callers can still override per-page
    ...components,
  };
}
