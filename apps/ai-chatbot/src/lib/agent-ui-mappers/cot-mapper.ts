export type UiCoTStep = {
  label: string;
  description?: string;
  status: "complete" | "active" | "pending";
};

export const mapToolSequenceToCoT = (
  steps: { label: string; done: boolean }[]
): UiCoTStep[] =>
  steps.map((step, index) => ({
    label: step.label,
    status: step.done ? "complete" : index === 0 ? "active" : "pending",
  }));
