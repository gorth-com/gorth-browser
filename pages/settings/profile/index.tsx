import { UserRound } from "@gorth-io/primitive/cores/lucide";
import { PageHeading } from "@/components/heading";
import { AccountCard } from "@/components/element/account-card";
import { Wrapper } from "@/layouts/wrapper";
import { ProfilePreferences } from "@/components/element/profile-preferences";

export function ProfilePage() {
  return (
    <Wrapper>
      <div className="flex flex-col gap-6">
        <PageHeading icon={UserRound} title="Gorth profile" />
        <AccountCard>
          <ProfilePreferences />
        </AccountCard>
      </div>
    </Wrapper>
  );
}
