import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { canManageLabels, canToggleTaskLabels } from "@/features/authorization/permissions";

export const MAX_LABEL_NAME_LENGTH = 50;
/** Chỉ chấp nhận hex `#RRGGBB` — tránh nội suy CSS tuỳ ý vào style. */
export const LABEL_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface ColorOption {
  hex: string;
  name: string;
}

export const LABEL_COLOR_OPTIONS: ColorOption[] = [
  { hex: "#dc2626", name: "Red (Bug)" },
  { hex: "#ea580c", name: "Orange (Urgent)" },
  { hex: "#d97706", name: "Amber (Docs)" },
  { hex: "#16a34a", name: "Green (Feature)" },
  { hex: "#0f766e", name: "Teal (Improvement)" },
  { hex: "#0284c7", name: "Blue (Task)" },
  { hex: "#7c3aed", name: "Purple (Refactor)" },
  { hex: "#db2777", name: "Pink (Design)" },
  { hex: "#475569", name: "Slate (Ops)" },
];

export const DEFAULT_PROJECT_LABELS = [
  { name: "Bug", color: "#dc2626" },
  { name: "Feature", color: "#0284c7" },
  { name: "Improvement", color: "#0f766e" },
  { name: "Documentation", color: "#d97706" },
  { name: "Refactor", color: "#7c3aed" },
] as const;

/** Palette gợi ý cho UI; service vẫn nhận mọi màu hex hợp lệ. */
export const LABEL_COLOR_PALETTE = LABEL_COLOR_OPTIONS.map((c) => c.hex);

export interface LabelRecord {
  id: string;
  name: string;
  color: string;
  projectId: string;
  workspaceId: string;
}

export interface LabelRepository {
  getLabel(labelId: string): Promise<LabelRecord | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  getTaskWorkspaceId(taskId: string): Promise<string | null>;
  getTaskProjectId(taskId: string): Promise<string | null>;
  listLabelsByProject(projectId: string): Promise<LabelRecord[]>;
  createLabel(input: { projectId: string; name: string; color: string }): Promise<LabelRecord>;
  updateLabel(input: { labelId: string; name?: string; color?: string }): Promise<LabelRecord>;
  deleteLabel(labelId: string): Promise<void>;
  /** Label ids hiện gắn trên task (cho toggle UI). */
  listTaskLabelIds(taskId: string): Promise<string[]>;
  addLabelToTask(taskId: string, labelId: string): Promise<void>;
  removeLabelFromTask(taskId: string, labelId: string): Promise<void>;
  /** Tất cả task-label dưới dạng map cho board — đã lọc theo task. */
  listLabelsByTaskIds(taskIds: string[]): Promise<{ taskId: string; label: LabelRecord }[]>;
}

interface Deps {
  repo: LabelRepository;
}

export function createLabelService({ repo }: Deps) {
  /** Xác minh label (qua project -> workspace) thuộc workspace của actor. */
  async function fetchOwnedLabel(actor: Actor, labelId: string): Promise<LabelRecord> {
    const label = await repo.getLabel(labelId);
    if (!label || label.workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Label not found or does not belong to your workspace.");
    }
    return label;
  }

  /** Xác minh project thuộc workspace của actor. */
  async function fetchOwnedProject(actor: Actor, projectId: string): Promise<string> {
    const workspaceId = await repo.getProjectWorkspaceId(projectId);
    if (!workspaceId || workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Project not found or does not belong to your workspace.");
    }
    return workspaceId;
  }

  function validateName(raw: string): string {
    const name = raw.trim();
    if (name.length === 0) throw new ValidationError("Label name is required.");
    if (name.length > MAX_LABEL_NAME_LENGTH) {
      throw new ValidationError(`Label name must be at most ${MAX_LABEL_NAME_LENGTH} characters.`);
    }
    return name;
  }

  function validateColor(raw: string): string {
    const color = raw.trim();
    if (!LABEL_COLOR_PATTERN.test(color)) {
      throw new ValidationError("Label color must be a hex value like #0f766e.");
    }
    return color;
  }

  /** Danh sách label của project — mọi member đọc (Mốc 10). */
  async function listLabels(actor: Actor, projectId: string): Promise<LabelRecord[]> {
    await fetchOwnedProject(actor, projectId);
    return repo.listLabelsByProject(projectId);
  }

  /** Tạo label — Owner/Admin (Mốc 10). */
  async function createLabel(
    actor: Actor,
    projectId: string,
    input: { name: string; color: string },
  ): Promise<LabelRecord> {
    await fetchOwnedProject(actor, projectId);
    requirePermission(actor, canManageLabels(effectiveRole(actor)), "Only Owners and Admins can create labels.");
    return repo.createLabel({ projectId, name: validateName(input.name), color: validateColor(input.color) });
  }

  /** Sửa label — Owner/Admin (Mốc 10). */
  async function updateLabel(
    actor: Actor,
    labelId: string,
    input: { name?: string; color?: string },
  ): Promise<LabelRecord> {
    await fetchOwnedLabel(actor, labelId);
    requirePermission(actor, canManageLabels(effectiveRole(actor)), "Only Owners and Admins can edit labels.");
    return repo.updateLabel({
      labelId,
      name: input.name === undefined ? undefined : validateName(input.name),
      color: input.color === undefined ? undefined : validateColor(input.color),
    });
  }

  /** Xoá label — Owner/Admin; TaskLabel cascade dọn theo (Mốc 10). */
  async function deleteLabel(actor: Actor, labelId: string): Promise<void> {
    await fetchOwnedLabel(actor, labelId);
    requirePermission(actor, canManageLabels(effectiveRole(actor)), "Only Owners and Admins can delete labels.");
    await repo.deleteLabel(labelId);
  }

  /**
   * Gắn label vào task — mọi member (Mốc 10). Label phải thuộc cùng project với
   * task (không gắn chéo project). Không ghi Activity — theo nguyên tắc FR-071
   * audit gọn (chỉ task-field change + create được log).
   */
  async function addLabelToTask(actor: Actor, taskId: string, labelId: string): Promise<void> {
    requirePermission(actor, canToggleTaskLabels(effectiveRole(actor)), "You do not have permission to add labels.");
    const [taskWorkspaceId, taskProjectId, label] = await Promise.all([
      repo.getTaskWorkspaceId(taskId),
      repo.getTaskProjectId(taskId),
      repo.getLabel(labelId),
    ]);
    if (!taskWorkspaceId || taskWorkspaceId !== actor.workspaceId || !taskProjectId) {
      throw new UnauthorizedError("Task not found or does not belong to your workspace.");
    }
    if (!label || label.projectId !== taskProjectId) {
      throw new UnauthorizedError("Label not found in this task's project.");
    }
    const attached = await repo.listTaskLabelIds(taskId);
    if (!attached.includes(labelId)) {
      await repo.addLabelToTask(taskId, labelId);
    }
  }

  /** Gỡ label khỏi task — mọi member (Mốc 10). Tương tự không ghi Activity. */
  async function removeLabelFromTask(actor: Actor, taskId: string, labelId: string): Promise<void> {
    requirePermission(actor, canToggleTaskLabels(effectiveRole(actor)), "You do not have permission to remove labels.");
    const taskWorkspaceId = await repo.getTaskWorkspaceId(taskId);
    if (!taskWorkspaceId || taskWorkspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Task not found or does not belong to your workspace.");
    }
    await repo.removeLabelFromTask(taskId, labelId);
  }

  return {
    listLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    addLabelToTask,
    removeLabelFromTask,
  };
}

export type LabelService = ReturnType<typeof createLabelService>;