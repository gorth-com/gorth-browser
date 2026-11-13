import { useEffect, useState } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  Globe2,
  UserRound,
  Rocket,
  Star,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import { CardTitle } from "@gorth-io/primitive/default/card";
import { useBrowserSetup } from "@/hooks/use-browser-setup";
import {
  setupPreferencesSchema,
  type SetupPreferences,
} from "@/lib/browser/setup";
import { toast } from "@/providers/toaster";
import { ErrorFeedback } from "@/components/element/error-feedback";
const profileIcons = {
  globe: Globe2,
  user: UserRound,
  rocket: Rocket,
  star: Star,
};
export function ProfilePreferences() {
  const setup = useBrowserSetup();
  const [busy, setBusy] = useState(false);
  const disabled = busy || !setup.data;
  const profileForm = useForm({
    defaultValues: {
      name: "",
      icon: "user" as SetupPreferences["profileIcon"],
    },
    onSubmit: async ({ value }) => {
      if (!setup.data) return;
      setBusy(true);
      try {
        const preferences = setupPreferencesSchema.parse({
          ...setup.data,
          profileName: value.name,
          profileIcon: value.icon,
        });
        setup.accept(await window.electronAPI.setup.save(preferences));
        toast.add({ title: "Profile saved", type: "success" });
      } catch (error) {
        toast.add({
          title:
            error instanceof Error ? error.message : "Unable to save profile",
          type: "error",
        });
      } finally {
        setBusy(false);
      }
    },
  });
  useEffect(() => {
    if (setup.data) {
      profileForm.setFieldValue("name", setup.data.profileName);
      profileForm.setFieldValue("icon", setup.data.profileIcon);
    }
  }, [setup.data?.profileName, setup.data?.profileIcon, profileForm]);
  return (
    <>
      <ErrorFeedback message={setup.error?.message} />
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void profileForm.handleSubmit();
        }}
      >
        <profileForm.Field name="name">
          {(field) => (
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Profile name</CardTitle>
              <Input
                className="w-45"
                aria-label="Profile name"
                required
                maxLength={80}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </profileForm.Field>
        <div className="flex items-center justify-between gap-4">
          <Button disabled={disabled} type="submit">
            Save profile
          </Button>
          <profileForm.Field name="icon">
            {(field) => (
              <div className="flex flex-wrap gap-2">
                {Object.entries(profileIcons).map(([key, ProfileIcon]) => (
                  <Button
                    key={key}
                    type="button"
                    aria-label={`${key} profile icon`}
                    aria-pressed={field.state.value === key}
                    variant={field.state.value === key ? "default" : "outline"}
                    onClick={() =>
                      field.handleChange(key as SetupPreferences["profileIcon"])
                    }
                  >
                    <ProfileIcon />
                  </Button>
                ))}
              </div>
            )}
          </profileForm.Field>
        </div>
      </form>
    </>
  );
}
