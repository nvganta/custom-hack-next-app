import * as React from "react";

interface EmailTemplateProps {
  name: string;
}

export function EmailTemplate({ name }: EmailTemplateProps) {
  return (
    <div>
      <h1>Welcome to CustomHack, {name}!</h1>
      <p>This is an email from your application.</p>
    </div>
  );
}
