"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  updateProfile,
  changePassword,
  createApiToken,
  deleteApiToken,
  generateMcpToken,
} from "@/app/actions/settings";
import { Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";

interface Token {
  id: number;
  type: string;
  name: string;
  maskedValue: string;
  createdAt: Date;
}

interface Props {
  profile: { name: string; email: string };
  isCredential: boolean;
  tokens: Token[];
}

export function SettingsClient({ profile, isCredential, tokens: initialTokens }: Props) {
  return (
    <div className="space-y-5">
      <ProfileSection profile={profile} />
      <ApiKeysSection tokens={initialTokens} />
      {isCredential && <ChangePasswordSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Section
// ---------------------------------------------------------------------------

function ProfileSection({ profile }: { profile: { name: string; email: string } }) {
  const [name, setName] = useState(profile.name);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateProfile(name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} disabled className="bg-muted" />
        </div>
        <Button onClick={handleSave} disabled={pending || name === profile.name}>
          {saved ? "Saved" : pending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------

function ApiKeysSection({ tokens: initialTokens }: { tokens: Token[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [pending, startTransition] = useTransition();

  // New key form
  const [newType, setNewType] = useState("openai");
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);

  // MCP token
  const [mcpName, setMcpName] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleAddKey() {
    if (!newName.trim() || !newValue.trim()) return;
    startTransition(async () => {
      await createApiToken(newType, newName.trim(), newValue.trim());
      setTokens((prev) => [
        ...prev,
        {
          id: Date.now(), // temporary, will be replaced on reload
          type: newType,
          name: newName.trim(),
          maskedValue: `****${newValue.trim().slice(-4)}`,
          createdAt: new Date(),
        },
      ]);
      setNewName("");
      setNewValue("");
    });
  }

  function handleDelete(tokenId: number) {
    startTransition(async () => {
      await deleteApiToken(tokenId);
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    });
  }

  function handleGenerateMcp() {
    if (!mcpName.trim()) return;
    startTransition(async () => {
      const plaintext = await generateMcpToken(mcpName.trim());
      setGeneratedToken(plaintext);
      setTokens((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "mcp",
          name: mcpName.trim(),
          maskedValue: "[hidden]",
          createdAt: new Date(),
        },
      ]);
      setMcpName("");
    });
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const grouped = tokens.reduce<Record<string, Token[]>>((acc, t) => {
    (acc[t.type] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>Manage API keys for AI providers and MCP access</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing tokens grouped by type */}
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {type}
            </h3>
            {items.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{token.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {token.maskedValue}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(token.id)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ))}

        {tokens.length === 0 && (
          <p className="text-sm text-muted-foreground">No API keys configured yet.</p>
        )}

        {/* Add new API key */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium">Add API Key</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="key-type" className="text-xs">Type</Label>
              <select
                id="key-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="key-name" className="text-xs">Name</Label>
              <Input
                id="key-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="key-value" className="text-xs">API Key</Label>
            <div className="relative">
              <Input
                id="key-value"
                type={showValue ? "text" : "password"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleAddKey} disabled={pending || !newName.trim() || !newValue.trim()}>
            {pending ? "Adding..." : "Add Key"}
          </Button>
        </div>

        {/* Generate MCP token */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium">Generate MCP Token</h3>
          <p className="text-xs text-muted-foreground">
            Generate a token for MCP server authentication. The token will only be shown once.
          </p>
          <div className="flex gap-2">
            <Input
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
              placeholder="Token name"
              className="flex-1"
            />
            <Button
              onClick={handleGenerateMcp}
              disabled={pending || !mcpName.trim()}
              variant="outline"
            >
              Generate
            </Button>
          </div>
          {generatedToken && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Copy this token now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all bg-muted p-2 rounded font-mono">
                  {generatedToken}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(generatedToken)}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Change Password Section
// ---------------------------------------------------------------------------

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSubmit() {
    if (!currentPassword || !newPassword) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await changePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
        setMessage({ type: "success", text: "Password updated successfully." });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to change password";
        setMessage({ type: "error", text: msg });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"
            }`}
          >
            {message.text}
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={pending || !currentPassword || !newPassword}
        >
          {pending ? "Updating..." : "Update Password"}
        </Button>
      </CardContent>
    </Card>
  );
}
