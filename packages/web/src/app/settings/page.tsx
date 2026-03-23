import { getProfile, hasCredentialAccount, getApiTokens } from "@/app/actions/settings";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Settings — Flashcards",
};

export default async function SettingsPage() {
  const [profile, isCredential, tokens] = await Promise.all([
    getProfile(),
    hasCredentialAccount(),
    getApiTokens(),
  ]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 sm:p-6 space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
      <SettingsClient profile={profile} isCredential={isCredential} tokens={tokens} />
    </div>
  );
}
