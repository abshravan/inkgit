export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-3 border-b pt-12 pb-8 sm:pt-16">
      {eyebrow && <p className="text-sm font-medium text-brand">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {description && <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{description}</p>}
    </header>
  );
}
