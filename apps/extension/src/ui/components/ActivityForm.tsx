import { useId, useState, type FormEvent } from 'react';
import type { Importance, ScoredCategory } from '@hubris/types';
import type { CreateActivityInput } from '../../storage/repository';
import { errorMessage } from '../lib/errors';
import { CATEGORIES, IMPORTANCE_BY_ID, IMPORTANCE_OPTIONS } from '../lib/categories';
import { PlaceholdersAndVanishInput } from './aceternity/placeholders-and-vanish-input';
import { Button } from './21st/button';
import { NumberStepper } from './21st/number-stepper';
import { SegmentedControl } from './21st/segmented-control';

const PLACEHOLDERS = [
  'Leetcode',
  'Morning run',
  'Classical guitar',
  'System design',
  'Read 30 pages',
] as const;

export interface ActivityFormProps {
  initialValues?: {
    name: string;
    category: ScoredCategory;
    timesPerWeek: number;
    importance: Importance;
  };
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  onSubmit: (values: CreateActivityInput) => Promise<unknown>;
  onSuccess?: () => void;
}

export function ActivityForm({
  initialValues,
  submitLabel = 'Save activity',
  onCancel,
  cancelLabel = 'Cancel',
  onSubmit,
  onSuccess,
}: ActivityFormProps) {
  const uid = useId();
  const nameId = `${uid}-name`;
  const nameErrorId = `${uid}-name-error`;
  const goalId = `${uid}-goal`;
  const goalErrorId = `${uid}-goal-error`;

  const [name, setName] = useState(initialValues?.name ?? '');
  const [category, setCategory] = useState<ScoredCategory>(initialValues?.category ?? 'career');
  const [timesPerWeek, setTimesPerWeek] = useState<number>(initialValues?.timesPerWeek ?? 3);
  const [importance, setImportance] = useState<Importance>(initialValues?.importance ?? 'high');

  const [nameError, setNameError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validateFields = (
    rawName: string,
    rawGoal: number,
  ): { valid: boolean; nameMsg: string | null; goalMsg: string | null } => {
    const trimmed = rawName.trim();
    let nameMsg: string | null = null;
    if (trimmed.length === 0) {
      nameMsg = 'Enter an activity name.';
    } else if (trimmed.length > 60) {
      nameMsg = 'Use at most 60 characters for the name.';
    }

    let goalMsg: string | null = null;
    if (!Number.isFinite(rawGoal) || !Number.isInteger(rawGoal)) {
      goalMsg = 'Weekly goal must be a whole number.';
    } else if (rawGoal < 1) {
      goalMsg = 'Weekly goal must be at least 1.';
    } else if (rawGoal > 99) {
      goalMsg = 'Weekly goal must be at most 99.';
    }

    return {
      valid: nameMsg === null && goalMsg === null,
      nameMsg,
      goalMsg,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRepoError(null);
    const check = validateFields(name, timesPerWeek);
    setNameError(check.nameMsg);
    setGoalError(check.goalMsg);
    if (!check.valid) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        timesPerWeek,
        importance,
      });
      onSuccess?.();
    } catch (error) {
      setRepoError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.label,
    subtitle: `${cat.weightPercent}%`,
    dotColor: cat.color,
  }));

  const importanceOptions = IMPORTANCE_OPTIONS.map((imp) => ({
    value: imp.id,
    label: imp.label,
    subtitle: `${imp.weightPercent}%`,
  }));

  const selectedImportanceMeta = IMPORTANCE_BY_ID[importance];

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={nameId} className="text-xs font-medium text-text">
            Activity name
          </label>
          <span className="text-[11px] text-muted tabular-nums">
            {name.trim().length}/60
          </span>
        </div>
        <PlaceholdersAndVanishInput
          id={nameId}
          value={name}
          onChange={(val) => {
            setName(val);
            if (nameError) setNameError(null);
            if (repoError) setRepoError(null);
          }}
          placeholders={PLACEHOLDERS}
          ariaInvalid={Boolean(nameError)}
          ariaDescribedBy={nameError ? nameErrorId : undefined}
        />
        {nameError && (
          <p id={nameErrorId} role="alert" className="text-xs text-red-300">
            {nameError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-text">Category</span>
        <SegmentedControl
          ariaLabel="Category"
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          layoutId={`${uid}-cat`}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={goalId} className="block text-xs font-medium text-text">
          Weekly goal
        </label>
        <NumberStepper
          id={goalId}
          value={timesPerWeek}
          onChange={(val) => {
            setTimesPerWeek(val);
            if (goalError) setGoalError(null);
            if (repoError) setRepoError(null);
          }}
          min={1}
          max={99}
          ariaInvalid={Boolean(goalError)}
          ariaDescribedBy={goalError ? goalErrorId : undefined}
        />
        {goalError && (
          <p id={goalErrorId} role="alert" className="text-xs text-red-300">
            {goalError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text">Importance</span>
          <span className="text-xs text-accent-soft font-medium">
            {selectedImportanceMeta.weightSummary}
          </span>
        </div>
        <SegmentedControl
          ariaLabel="Importance"
          options={importanceOptions}
          value={importance}
          onChange={setImportance}
          layoutId={`${uid}-imp`}
        />
        <p className="text-[11px] text-muted">
          High counts 40%, Medium counts 35%, Low counts 25% inside each category.
        </p>
      </div>

      {repoError && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200">
          {repoError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
