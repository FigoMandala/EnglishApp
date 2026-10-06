import { parseMarkdown, type Span } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function SpanText({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, index) => {
        if (span.tone === "bold") {
          return (
            <strong key={index} className="font-semibold text-ink">
              {span.text}
            </strong>
          );
        }
        if (span.tone === "code") {
          return (
            <code key={index} className="rounded-control bg-surface-muted px-1 py-px font-mono text-[0.85em]">
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
                "font-semibold text-ink",
                block.level === 2 ? "mt-2 text-[1.125rem]" : "mt-1 text-[1rem]",
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
        return (
          <p key={index} className="text-[0.9375rem] leading-relaxed text-ink-muted">
            <SpanText spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
