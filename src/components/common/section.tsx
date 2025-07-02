interface SectionProps {
  children: React.ReactNode;
  title?: string;
  as?: "section" | "div" | "form" | "article" | "header" | "footer";
  className?: string;
}

export default function Section({
  children,
  title,
  as = "section",
  className = "",
  ...rest
}: SectionProps) {
  const Component = as;

  return (
    <Component
      className="flex flex-col gap-4 bg-white px-4 py-4 rounded-lg border border-gray-200"
      {...rest}
    >
      {title && <h2 className="text-xl font-bold text-gray-400">{title}</h2>}
      <div className={`flex flex-col md:flex-row gap-4 ${className}`}>
        {children}
      </div>
    </Component>
  );
}
