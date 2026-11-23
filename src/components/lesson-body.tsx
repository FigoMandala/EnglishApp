import { parseMarkdown, type Span } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function SpanText({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, index) => {
        if (span.tone === "bold") {
          return (
            <strong key={index} className="font-extrabold text-ink">
              {span.text}
            </strong>
          );
        }
        if (span.tone === "code") {
          return (
            <code key={index} className="rounded-[6px] bg-primary-soft px-1.5 py-px font-bold text-primary-deep">
              {span.text}
            </code>
          );
        }
        return <span key={index}>{span.text}</span>;
      })}
    </>
  );
}

export function LessonBody({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-4">
      {parseMarkdown(body).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h2
              key={index}
              className={cn(
                "font-display font-extrabold text-ink",
                block.level === 2 ? "mt-2 text-[1.25rem]" : "mt-1 text-[1.0625rem]",
              )}
            >
              <SpanText spans={block.spans} />
            </h2>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={cn(
                "ml-5 flex flex-col gap-1.5 text-[0.9375rem] leading-relaxed text-ink-muted",
                block.ordered ? "list-decimal" : "list-disc",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1">
                  <SpanText spans={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-[16px] border-2 border-hairline">
              <table className="w-full border-collapse text-left text-[0.875rem]" style={{ minWidth: block.header.length * 100 }}>
                <thead>
                  <tr className="bg-primary-soft text-primary-deep">
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex} scope="col" className="px-3 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.04em]">
                        <SpanText spans={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t-2 border-hairline">
                      {row.map((cell, cellIndex) =>
                        cellIndex === 0 ? (
                          <th key={cellIndex} scope="row" className="bg-canvas-deep/60 px-3 py-2.5 align-top font-extrabold text-ink">
                            <SpanText spans={cell} />
                          </th>
                        ) : (
                          <td key={cellIndex} className="px-3 py-2.5 align-top leading-snug text-ink-muted">
                            <SpanText spans={cell} />
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={index} className="text-[0.9375rem] leading-relaxed text-ink-muted">
            <SpanText spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
