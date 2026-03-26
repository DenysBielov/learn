"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [formError, setFormError] = useState<string | null>(
    error === "INVALID_TOKEN" ? "This reset link is invalid or has expired." : null
  );
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token && !error) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
          Missing reset token. Please request a new password reset link.
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/forgot-password"
            className="text-primary underline-offset-4 hover:underline"
          >
            Request new link
          </Link>
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword.length < 8) {
      setFormError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match");
      setLoading(false);
      return;
    }

    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token: token!,
    });

    if (resetError) {
      setFormError("This reset link is invalid or has expired.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-muted p-4 text-center text-sm">
          Your password has been reset successfully.
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in with your new password
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="text-primary underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </p>
    </div>
  );
}
