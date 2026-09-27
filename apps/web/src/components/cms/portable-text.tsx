import {
  PortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
} from '@portabletext/react';
import type { TypedObject } from '@portabletext/types';
import {
  KBS_LABELS,
  KBS_LABEL_DEFINITIONS,
  type KbsLabelLanguage,
} from '@kambriq/common/kbs/label-definitions';

/**
 * Renders a CMS document.
 *
 * The component map is the one `apps/web/mdx-components.tsx` carried, so the
 * migration out of mdx changed the source of the words and not their
 * appearance.
 *
 * There is no `h1`: a policy's title is a field and an editorial page's heading
 * comes from the translation files, so an `h1` in a body would be a second
 * top-level heading. The Studio does not offer the style - the guard is there
 * rather than here, because `@portabletext/react` merges its own components
 * under ours and an unknown STYLE resolves to the library's unstyled heading
 * without ever reaching `onMissingComponent`. That is measured in
 * `portable-text.spec.tsx`.
 *
 * It REFUSES what it cannot render. `@portabletext/react` defaults
 * `onMissingComponent` to a console warning and then renders the node with a
 * fallback, exactly as `@portabletext/to-html` does - so a block type added in
 * the Studio and not here would produce a page that looks complete with a
 * section missing. The archive already takes this position; a page has the same
 * reason to.
 */

interface LinkValue {
  href?: string;
}

const TableBlock = ({
  value,
}: {
  value: { columns?: string[]; rows?: { cells?: string[] }[] };
}) => (
  <div className="my-8 overflow-x-auto">
    <table className="w-full border-collapse text-left text-sm">
      <thead className="border-b-2 border-gray-300 bg-gray-50">
        <tr>
          {(value.columns ?? []).map((column) => (
            <th key={column} className="px-4 py-3 font-semibold text-gray-900">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {(value.rows ?? []).map((row, rowIndex) => (
          <tr key={rowIndex}>
            {(row.cells ?? []).map((cell, cellIndex) => (
              <td key={cellIndex} className="px-4 py-3 text-gray-600">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * The three KAMBRIQ labels, from `libs/common/src/kbs/label-definitions.ts`.
 *
 * The block carries no text of its own. The definitions are pinned to the KBS
 * question bank, and a wording an editor could change here would be the same
 * fact in two places with nothing comparing them.
 */
const LabelDefinitions = ({ language }: { language: KbsLabelLanguage }) => (
  <>
    {KBS_LABELS.map((code) => {
      const definition = KBS_LABEL_DEFINITIONS[code];
      return (
        <div key={code}>
          <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-800">
            {`KAMBRIQ ${code}™ - ${definition.expansion}`}
          </h3>
          <p className="mb-5 leading-relaxed text-gray-600">
            {definition.description[language].map((run, index) =>
              run.strong ? (
                <strong key={index} className="font-semibold text-gray-900">
                  {run.text}
                </strong>
              ) : (
                <span key={index}>{run.text}</span>
              ),
            )}
          </p>
        </div>
      );
    })}
  </>
);

export function cmsComponents(language: KbsLabelLanguage): PortableTextComponents {
  return {
    block: {
      normal: ({ children }) => <p className="mb-5 leading-relaxed text-gray-600">{children}</p>,
      h2: ({ children }) => (
        <h2 className="mt-10 mb-4 text-xl font-semibold text-gray-900">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-800">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="mt-6 mb-2 text-base font-semibold text-gray-800">{children}</h4>
      ),
      blockquote: ({ children }) => (
        <blockquote className="my-6 border-l-4 border-primary-400 pl-5 text-gray-600 italic">
          {children}
        </blockquote>
      ),
    },
    list: {
      bullet: ({ children }) => <ul className="mb-5 space-y-2 pl-6">{children}</ul>,
      number: ({ children }) => <ol className="mb-5 list-decimal space-y-2 pl-6">{children}</ol>,
    },
    listItem: {
      bullet: ({ children }) => (
        <li className="leading-relaxed text-gray-600 marker:text-primary-500">{children}</li>
      ),
      number: ({ children }) => (
        <li className="leading-relaxed text-gray-600 marker:text-primary-500">{children}</li>
      ),
    },
    marks: {
      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
      em: ({ children }) => <em className="text-gray-700 italic">{children}</em>,
      code: ({ children }) => (
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm">{children}</code>
      ),
      link: ({
        value,
        children,
      }: PortableTextMarkComponentProps<LinkValue & { _type: string }>) => (
        <a
          href={value?.href}
          className="font-medium text-primary-600 underline underline-offset-2 hover:text-primary-800"
        >
          {children}
        </a>
      ),
    },
    types: {
      divider: () => <hr className="my-10 border-gray-200" />,
      labelDefinitions: () => <LabelDefinitions language={language} />,
      table: TableBlock,
    },
  };
}

/** Thrown when a document carries something this renderer cannot reproduce. */
export class UnrenderableDocumentError extends Error {
  constructor(detail: string) {
    super(`Refusing to render a document this app cannot reproduce: ${detail}`);
    this.name = 'UnrenderableDocumentError';
  }
}

/**
 * `TypedObject[]` rather than `PortableTextBlock[]`: the array carries blocks AND
 * the object types above, and a declaration that admitted only blocks would be a
 * type that disagrees with the value - which is how a wrong annotation recruits
 * the compiler into agreeing with a defect.
 */
export function CmsBody({ body, language }: { body: TypedObject[]; language: KbsLabelLanguage }) {
  return (
    <PortableText<TypedObject>
      value={body}
      components={cmsComponents(language)}
      onMissingComponent={(message, options) => {
        throw new UnrenderableDocumentError(`${options.nodeType} "${options.type}": ${message}`);
      }}
    />
  );
}
