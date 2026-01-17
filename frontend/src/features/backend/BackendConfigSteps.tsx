import { RightPaddedIcon } from "@/components/icon";

require("bootstrap-icons/font/bootstrap-icons.css");

export enum ValidationState {
  IN_PROGRESS = "record-circle-fill",
  SUCCEEDED = "check-circle-fill",
  FAILED = "x-circle-fill",
}

export interface BackendConfigStep {
  label: string;
  callable: (arg?: any) => Promise<{ success: boolean; nextArg?: any }>;
}

export const evaluateSteps = async (
  steps: Array<BackendConfigStep>,
  setValidationStatus: (newSteps: Array<ValidationState>) => void
): Promise<boolean> => {
  let updatedValidationStatus: Array<ValidationState> = [];
  setValidationStatus(updatedValidationStatus);
  let arg: any = undefined;

  for (const { callable } of steps) {
    updatedValidationStatus.push(ValidationState.IN_PROGRESS);
    setValidationStatus(updatedValidationStatus);
    const outcome = await callable(...(arg !== undefined ? [arg] : []));
    updatedValidationStatus = [
      ...updatedValidationStatus.slice(0, -1),
      outcome.success ? ValidationState.SUCCEEDED : ValidationState.FAILED,
    ];
    setValidationStatus(updatedValidationStatus);
    if (!outcome.success) {
      break;
    }
    arg = outcome.nextArg;
  }
  return updatedValidationStatus.every(
    (item) => item === ValidationState.SUCCEEDED
  );
};

export const BackendConfigSteps = ({
  validationStatus,
  steps,
}: {
  validationStatus: Array<ValidationState>;
  steps: Array<BackendConfigStep>;
}) => {
  return (
    validationStatus.length > 0 && (
      <ul>
        {steps.map(({ label }, i) => (
          <li key={label}>
            <RightPaddedIcon
              bootstrapIconName={validationStatus[i] ?? "circle"}
            />{" "}
            {label}
            {validationStatus[i] === ValidationState.IN_PROGRESS && "..."}
          </li>
        ))}
      </ul>
    )
  );
};
