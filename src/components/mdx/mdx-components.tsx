import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Callout } from "./callout";
import { CodeBlock } from "./code-block";

/**
 * The complete set of components available to MDX content. Anything not
 * listed here (and in remark-safe-mdx's allowlist) is unavailable to authors.
 */
export const mdxComponents: MDXComponents = {
  a: ({ href = "", children, ...props }) => {
    if (href.startsWith("/") && !href.startsWith("//")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    }
    const external = /^https?:\/\//.test(href);
    return (
      <a href={href} {...(external && { target: "_blank", rel: "noopener noreferrer" })} {...props}>
        {children}
      </a>
    );
  },
  // Content images can be any size/host; native lazy loading avoids layout-blocking work.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  img: (props) => <img loading="lazy" decoding="async" className="rounded-lg border" {...props} />,
  pre: CodeBlock,
  table: (props) => (
    <div className="my-6 w-full overflow-x-auto">
      <table {...props} />
    </div>
  ),
  Callout,
};
