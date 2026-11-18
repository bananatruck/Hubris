import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Archive, ArchiveRestore, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { TrackedActivity } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { errorMessage } from '../lib/errors';
import { useNotify } from '../lib/notify';
import { useDialogAction } from '../lib/useDialogAction';
import { CATEGORY_BY_ID, IMPORTANCE_BY_ID } from '../lib/categories';
import { ActivityForm } from '../components/ActivityForm';
import { Button } from '../components/21st/button';
import { Dialog, DialogContent } from '../components/21st/dialog';
import { Input } from '../components/21st/input';
import { SegmentedControl, type SegmentedOption } from '../components/21st/segmented-control';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

const IMPORT_MODE_OPTIONS: readonly SegmentedOption<'replace' | 'merge'>[] = [
  { value: 'replace', label: 'Replace' },
  { value: 'merge', label: 'Merge' },
];

export function SettingsScreen() {
  const uid = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = useNotify();
  const deletion = useDialogAction();
  const erasure = useDialogAction();
  const fileInputId = `${uid}-backup-file`;
  const eraseInputId = `${uid}-erase-input`;

  const { activities, actions } = useHubris();

  const [addOpen, setAddOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<TrackedActivity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<TrackedActivity | null>(null);

  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseConfirmation, setEraseConfirmation] = useState('');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setSelectedFile(file);
    setImportSuccess(null);
    setImportErrors([]);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportSuccess(null);
    setImportErrors([]);
    try {
      const counts = await actions.importBackup(selectedFile, importMode);
      setImportSuccess(
        `Imported ${counts.activities} ${counts.activities === 1 ? 'activity' : 'activities'} and ${counts.logs} ${counts.logs === 1 ? 'log' : 'logs'}.`,
      );
      setSelectedFile(null);
      fileInput.current?.focus();
    } catch (error) {
      const message = errorMessage(error);
      setImportErrors(message.split('\n').filter((line) => line.trim().length > 0));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmDeleteActivity = () => {
    if (!deletingActivity) return;
    void deletion.run(() => actions.deleteActivity(deletingActivity.id), () => setDeletingActivity(null));
  };

  const handleConfirmEraseAll = () => {
    if (eraseConfirmation !== 'erase') return;
    void erasure.run(actions.eraseAll, () => {
      setEraseOpen(false);
      setEraseConfirmation('');
    });
  };

  const handleQuickAction = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (cause) {
      notify({ message: errorMessage(cause), tone: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <section aria-label="Manage activities" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-text">
            Manage activities
          </h2>
          <Button ref={addButton} variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add activity
          </Button>
        </div>

        {activities.length === 0 ? (
          <SpotlightCard className="p-4 text-center space-y-2">
            <p className="text-xs text-muted">
              No activities configured yet. Add an activity to start tracking.
            </p>
          </SpotlightCard>
        ) : (
          <SpotlightCard className="divide-y divide-line overflow-hidden">
            {activities.map((activity) => {
              const catMeta = CATEGORY_BY_ID[activity.category];
              const impMeta = IMPORTANCE_BY_ID[activity.importance];

              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: catMeta.color }}
                      />
                      <span
                        className={
                          activity.archived
                            ? 'text-sm font-medium text-muted line-through truncate'
                            : 'text-sm font-medium text-text truncate'
                        }
                      >
                        {activity.name}
                      </span>
                      {activity.archived && (
                        <span className="rounded-full bg-raised border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="pl-4 text-[11px] text-muted">
                      {catMeta.label} - {activity.timesPerWeek}x/week - {impMeta.label} ({impMeta.weightPercent}%)
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${activity.name}`}
                      onClick={() => setEditingActivity(activity)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        activity.archived
                          ? `Restore ${activity.name}`
                          : `Archive ${activity.name}`
                      }
                      onClick={() => void handleQuickAction(() => actions.setArchived(activity.id, !activity.archived))}
                    >
                      {activity.archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${activity.name}`}
                      onClick={() => { deletion.clearError(); setDeletingActivity(activity); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted hover:text-red-300" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </SpotlightCard>
        )}
      </section>

      <section aria-label="Data" className="space-y-2.5">
        <h2 className="font-display text-base font-semibold text-text">
          Data
        </h2>

        <SpotlightCard className="p-3.5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text">Export backup</p>
              <p className="text-[11px] text-muted">
                Download your activities and logs as a JSON file.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void handleQuickAction(actions.exportBackup)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export backup
            </Button>
          </div>

          <div className="border-t border-line pt-3.5 space-y-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text">Import backup</p>
              <p className="text-[11px] text-muted">
                Restore from a Hubris JSON file by replacing or merging.
              </p>
            </div>

            <SegmentedControl
              ariaLabel="Import mode"
              options={IMPORT_MODE_OPTIONS}
              value={importMode}
              onChange={setImportMode}
              layoutId="settings-import-mode"
            />

            <div className="space-y-2">
              <label
                htmlFor={fileInputId}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-raised/60 px-3 py-2 text-xs font-medium text-text hover:bg-raised"
              >
                <Upload className="h-3.5 w-3.5 text-accent-soft" aria-hidden="true" />
                <span>{selectedFile ? selectedFile.name : 'Choose backup JSON file'}</span>
              </label>
              <input
                ref={fileInput}
                id={fileInputId}
                aria-label="Import backup file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>

            {selectedFile && (
              <div className="rounded-lg border border-accent-soft/30 bg-ink/80 p-3 space-y-2">
                <p className="text-xs text-text">
                  Confirm importing <strong className="font-semibold">{selectedFile.name}</strong> in{' '}
                  <strong className="font-semibold">{importMode}</strong> mode?
                </p>
                {importMode === 'merge' && (
                  <p className="text-xs text-muted">
                    Merge adds everything in the file that is missing here, including items you deleted after this backup was made.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setSelectedFile(null); fileInput.current?.focus(); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={importing}
                    onClick={() => void handleConfirmImport()}
                  >
                    Confirm import
                  </Button>
                </div>
              </div>
            )}

            {importSuccess && (
              <p
                role="status"
                aria-live="polite"
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200"
              >
                {importSuccess}
              </p>
            )}

            {importErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200 space-y-1"
              >
                <p className="font-semibold">Import failed:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-line pt-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text">Erase all data</p>
              <p className="text-[11px] text-muted">
                Permanently remove all activities, logs, and settings.
              </p>
            </div>
            <Button variant="danger" onClick={() => { erasure.clearError(); setEraseOpen(true); }}>
              Erase all data
            </Button>
          </div>
        </SpotlightCard>
      </section>

      <section aria-label="About" className="space-y-2.5">
        <h2 className="font-display text-base font-semibold text-text">
          About
        </h2>
        <SpotlightCard className="p-3.5 space-y-2 text-xs text-muted leading-relaxed">
          <p className="text-text">
            Each activity is scored against its weekly goal (capped at 100%) and weighted 40% High, 35% Medium, and 25% Low within its category. Your weekly overall score combines 36% Career, 36% Health, and 28% Hobbies.
          </p>
          <p>
            Your data stays in this browser. Hubris makes no network requests.
          </p>
          <p className="text-[11px] text-muted font-medium">
            Version 0.1.0
          </p>
        </SpotlightCard>
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          returnFocusFallback={() => addButton.current}
          title="Add activity"
          description="Create a new weekly activity."
        >
          <ActivityForm
            submitLabel="Save activity"
            onCancel={() => setAddOpen(false)}
            onSubmit={actions.createActivity}
            onSuccess={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingActivity !== null}
        onOpenChange={(open) => {
          if (!open) setEditingActivity(null);
        }}
      >
        <DialogContent
          returnFocusFallback={() => addButton.current}
          title="Edit activity"
          description="Update the activity details and weekly target."
        >
          {editingActivity && (
            <ActivityForm
              initialValues={{
                name: editingActivity.name,
                category: editingActivity.category,
                timesPerWeek: editingActivity.timesPerWeek,
                importance: editingActivity.importance,
              }}
              submitLabel="Save changes"
              onCancel={() => setEditingActivity(null)}
              onSubmit={(patch) => actions.updateActivity(editingActivity.id, patch)}
              onSuccess={() => setEditingActivity(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingActivity !== null}
        onOpenChange={(open) => {
          if (!open && !deletion.pending) setDeletingActivity(null);
        }}
      >
        <DialogContent
          returnFocusFallback={() => addButton.current}
          title="Delete activity"
          description="Deleting this activity will also delete all of its logs."
        >
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted">
              Delete <strong className="text-text font-medium">{deletingActivity?.name}</strong>? All logs recorded for this activity will be permanently deleted too.
            </p>
            {deletion.error && <p role="alert" className="text-xs text-red-200">{deletion.error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={deletion.pending} onClick={() => setDeletingActivity(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deletion.pending} onClick={handleConfirmDeleteActivity}>
                Delete activity and logs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eraseOpen}
        onOpenChange={(open) => {
          if (erasure.pending) return;
          setEraseOpen(open);
          if (!open) setEraseConfirmation('');
        }}
      >
        <DialogContent
          returnFocusFallback={() => addButton.current}
          title="Erase all data"
          description="Permanently delete all local activities and logs."
        >
          <div className="space-y-3 pt-2">
            <label htmlFor={eraseInputId} className="block text-xs text-muted">
              Type erase to confirm
            </label>
            <Input
              id={eraseInputId}
              value={eraseConfirmation}
              onChange={(event) => setEraseConfirmation(event.target.value)}
              placeholder="erase"
              disabled={erasure.pending}
            />
            {erasure.error && <p role="alert" className="text-xs text-red-200">{erasure.error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={erasure.pending}
                onClick={() => {
                  setEraseOpen(false);
                  setEraseConfirmation('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={erasure.pending || eraseConfirmation !== 'erase'}
                onClick={handleConfirmEraseAll}
              >
                Confirm erase
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
