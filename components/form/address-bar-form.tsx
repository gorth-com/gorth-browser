import type { FormEventHandler, ReactNode } from "react";

export function AddressBarForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form className="[-webkit-app-region:no-drag] relative min-w-24 flex-1" onSubmit={onSubmit}>
      {children}
    </form>
  );
}
