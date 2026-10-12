"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Panel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { TrashIcon } from "@/components/ui/icons";
import type { ApiKeyRecord } from "@/features/api-keys/api-key-service";
import { formatDate } from "@/lib/dates";
import { deleteApiKeyAction } from "@/features/api-keys/actions";
import { notifyApiKeyCreated, notifyApiKeyRevoked, notifyCopied, notifyError } from "@/lib/notify";
import { CreateApiKeyButton } from "@/features/api-keys/components/create-api-key-modal";

export function WorkspaceApiKeysPanel({
  workspaceId,
  apiKeys,
  canManage,
}: {
  workspaceId: string;
  apiKeys: ApiKeyRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Secret reveal modal state
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null);
  const [createdKeyName, setCreatedKeyName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Delete key state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  function handleKeyGenerated(keyName: string, secretKey: string) {
    setCreatedKeyName(keyName);
    setNewSecretKey(secretKey);
    // NOTE: toast text intentionally omits the key name — the table row
    // already shows it and E2E asserts its uniqueness.
    notifyApiKeyCreated();
  }

  function handleDelete(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key? Applications using it will lose access immediately.")) {
      return;
    }

    setDeletingId(keyId);
    startTransition(async () => {
      const res = await deleteApiKeyAction(workspaceId, keyId);
      setDeletingId(null);
      if (res.error) {
        notifyError(res.error);
      } else {
        notifyApiKeyRevoked();
        router.refresh();
      }
    });
  }

  async function handleCopy() {
    if (!newSecretKey) return;
    try {
      await navigator.clipboard.writeText(newSecretKey);
      setCopied(true);
      notifyCopied();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = newSecretKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      notifyCopied();
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Panel className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Public API Keys</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Manage API keys to authenticate with the REST API (/api/v1).
          </p>
        </div>
        {canManage && (
          <CreateApiKeyButton
            workspaceId={workspaceId}
            onKeyGenerated={handleKeyGenerated}
          />
        )}
      </div>

      {/* API Keys Table */}
      {apiKeys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule py-8 text-center">
          <p className="text-sm text-ink-soft">No API keys created yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Create an API key to access Mini Jira resources programmatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-field-bg/50 text-xs font-medium text-ink-soft">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key Prefix</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Created</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-field-bg/20">
                  <td className="px-4 py-3 font-medium text-ink">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    <span className="rounded bg-panel border border-rule px-1.5 py-0.5">
                      {key.keyPrefix}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft text-xs">
                    {key.user?.name || key.userId}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {key.expiresAt ? (
                      <span
                        className={
                          new Date(key.expiresAt).getTime() < now
                            ? "text-danger font-medium"
                            : ""
                        }
                      >
                        {formatDate(key.expiresAt)}
                      </span>
                    ) : (
                      "Never"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {formatDate(key.createdAt)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(key.id)}
                        disabled={deletingId === key.id}
                        className="rounded p-1 text-ink-soft hover:bg-danger/10 hover:text-danger disabled:opacity-50 transition-colors"
                        title="Revoke API key"
                        aria-label={`Revoke API key ${key.name}`}
                      >
                        {deletingId === key.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Secret Key Modal (1-time view) */}
      <Modal
        open={Boolean(newSecretKey)}
        onClose={() => setNewSecretKey(null)}
        panelClassName="max-w-lg p-6 space-y-4"
        labelledBy="apiKeyModalTitle"
      >
        <div className="space-y-1">
          <h3 id="apiKeyModalTitle" className="text-lg font-semibold text-ink">
            API Key Generated
          </h3>
          <p className="text-xs text-ink-soft">
            API key created for <strong>{createdKeyName}</strong>.
          </p>
        </div>

        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <strong>Important:</strong> Copy this secret key now. You will not be able to view it again once this modal is closed!
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-soft">Secret Key</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newSecretKey || ""}
              aria-label="Generated Secret Key"
              className="w-full rounded-md border border-rule bg-field-bg px-3 py-2 font-mono text-xs text-ink select-all focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={() => setNewSecretKey(null)}
          >
            I have copied the key
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
