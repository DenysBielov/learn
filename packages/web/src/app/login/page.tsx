import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const user = await getAuthUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-muted-foreground">
            Enter your credentials to continue
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
