import {
  BackendConfigStep,
  evaluateSteps,
  ValidationState,
} from "@/features/backend/BackendConfigSteps";

function makeStep(outcome: {
  success: boolean;
  nextArg?: any;
}): BackendConfigStep {
  return { label: "step", callable: jest.fn().mockResolvedValue(outcome) };
}

function makeThrowingStep(error: unknown): BackendConfigStep {
  return { label: "step", callable: jest.fn().mockRejectedValue(error) };
}

test("all steps succeed: returns true, all statuses SUCCEEDED", async () => {
  const steps = [makeStep({ success: true }), makeStep({ success: true })];
  const statuses: Array<Array<ValidationState>> = [];

  const result = await evaluateSteps(steps, (s) => statuses.push([...s]));

  expect(result).toBe(true);
  expect(statuses.at(-1)).toEqual([
    ValidationState.SUCCEEDED,
    ValidationState.SUCCEEDED,
  ]);
});

test("step returning success:false: returns false, step is FAILED, subsequent steps not run", async () => {
  const second = makeStep({ success: true });
  const steps = [makeStep({ success: false }), second];
  const statuses: Array<Array<ValidationState>> = [];

  const result = await evaluateSteps(steps, (s) => statuses.push([...s]));

  expect(result).toBe(false);
  expect(statuses.at(-1)).toEqual([ValidationState.FAILED]);
  expect(second.callable).not.toHaveBeenCalled();
});

test("step throwing an Error: returns false, step is FAILED, onError called with the error", async () => {
  const error = new Error("something went wrong");
  const steps = [makeThrowingStep(error)];
  const onError = jest.fn();
  const statuses: Array<Array<ValidationState>> = [];

  const result = await evaluateSteps(
    steps,
    (s) => statuses.push([...s]),
    onError
  );

  expect(result).toBe(false);
  expect(statuses.at(-1)).toEqual([ValidationState.FAILED]);
  expect(onError).toHaveBeenCalledWith(error);
});

test("step throwing a non-Error: onError is called with a wrapped Error", async () => {
  const steps = [makeThrowingStep("oops")];
  const onError = jest.fn();

  await evaluateSteps(steps, () => {}, onError);

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect(onError.mock.calls[0][0].message).toBe("oops");
});

test("throwing step: subsequent steps not run", async () => {
  const second = makeStep({ success: true });
  const steps = [makeThrowingStep(new Error("fail")), second];

  await evaluateSteps(steps, () => {});

  expect(second.callable).not.toHaveBeenCalled();
});

test("no onError provided when step throws: does not throw", async () => {
  const steps = [makeThrowingStep(new Error("fail"))];

  await expect(evaluateSteps(steps, () => {})).resolves.toBe(false);
});

test("nextArg is passed from one step to the next", async () => {
  const first = makeStep({ success: true, nextArg: { token: "abc" } });
  const second: BackendConfigStep = {
    label: "step",
    callable: jest.fn().mockResolvedValue({ success: true }),
  };
  const steps = [first, second];

  await evaluateSteps(steps, () => {});

  expect(second.callable).toHaveBeenCalledWith({ token: "abc" });
});

test("first step receives no argument", async () => {
  const first: BackendConfigStep = {
    label: "step",
    callable: jest.fn().mockResolvedValue({ success: true }),
  };

  await evaluateSteps([first], () => {});

  expect(first.callable).toHaveBeenCalledWith();
});

test("setValidationStatus transitions: IN_PROGRESS then SUCCEEDED per step", async () => {
  const steps = [makeStep({ success: true }), makeStep({ success: true })];
  const statuses: Array<Array<ValidationState>> = [];

  await evaluateSteps(steps, (s) => statuses.push([...s]));

  // initial empty call, then per-step: IN_PROGRESS -> SUCCEEDED
  expect(statuses).toEqual([
    [],
    [ValidationState.IN_PROGRESS],
    [ValidationState.SUCCEEDED],
    [ValidationState.SUCCEEDED, ValidationState.IN_PROGRESS],
    [ValidationState.SUCCEEDED, ValidationState.SUCCEEDED],
  ]);
});

test("middle step fails: earlier steps SUCCEEDED, failing step FAILED, later steps not run", async () => {
  const third = makeStep({ success: true });
  const steps = [
    makeStep({ success: true }),
    makeStep({ success: false }),
    third,
  ];
  const statuses: Array<Array<ValidationState>> = [];

  const result = await evaluateSteps(steps, (s) => statuses.push([...s]));

  expect(result).toBe(false);
  expect(statuses.at(-1)).toEqual([
    ValidationState.SUCCEEDED,
    ValidationState.FAILED,
  ]);
  expect(third.callable).not.toHaveBeenCalled();
});
