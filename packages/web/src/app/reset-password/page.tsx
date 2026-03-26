import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
