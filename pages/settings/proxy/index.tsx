import { Network } from "@gorth-com/primitive/cores/lucide";
import { Wrapper } from "@/layouts/wrapper";
import { PageHeading } from "@/components/heading";
import { ProxySettingsCard } from "@/components/element/proxy-settings";
export function ProxyPage() {
  return (
    <Wrapper>
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeading icon={Network} title="Proxy" />
        <ProxySettingsCard browser />
      </div>
    </Wrapper>
  );
}
