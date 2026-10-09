"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { createApiKeyAction } from "@/features/api-keys/actions";
import { formatDateInputValue } from "@/lib/dates";

export function CreateApiKeyModal({
  workspaceId,
  open,
  onClose,
  onKeyGenerated,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onKeyGenerated: (name: string, secretKey: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setExpiresAt("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name.trim());
      if (expiresAt) {
        formData.set("expiresAt", expiresAt);
      }

      const res = await createApiKeyAction(workspaceId, formData);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else if (res.secretKey) {
        onClose();
        onKeyGenerated(name.trim(), res.secretKey);
        router.refresh();
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-api-key-title"
      panelClassName="max-w-md p-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div>
          <h2 id="create-api-key-title" className="text-lg font-semibold tracking-tight text-ink">
            Create API Key
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Generate an API key for authenticating REST API requests.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        <Field label="Key Name *">
          <Input
            ref={inputRef}
            id="apiKeyName"
            name="name"
            aria-label="Key Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI/CD Pipeline or Backend Service"
            required
            maxLength={50}
            disabled={isPending}
          />
        </Field>

        <Field label="Expiration Date" hint="optional">
          <Input
            id="apiKeyExpiresAt"
            name="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={formatDateInputValue(new Date())}
            disabled={isPending}
            aria-label="Expiration Date"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || !name.trim()}
          >
            {isPending ? (
              <>
                <Spinner className="mr-1.5 h-3.5 w-3.5" />
                Generating...
              </>
            ) : (
              "Generate Key"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateApiKeyButton({
  workspaceId,
  onKeyGenerated,
}: {
  workspaceId: string;
  onKeyGenerated: (name: string, secretKey: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
        Create API Key
      </Button>
      <CreateApiKeyModal
        workspaceId={workspaceId}
        open={open}
        onClose={() => setOpen(false)}
        onKeyGenerated={onKeyGenerated}
      />
    </>
  );
}
