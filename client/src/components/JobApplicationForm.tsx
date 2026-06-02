import { X } from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { splitTechStack } from "../lib/utils";
import {
  JobApplicationStatus,
  jobApplicationStatusLabels,
  type JobApplication,
  type JobApplicationCreateInput,
  type JobApplicationUpdateInput,
} from "../types";

interface JobApplicationFormProps {
  onCreate: (input: JobApplicationCreateInput) => Promise<JobApplication>;
  onUpdate: (id: string, input: JobApplicationUpdateInput) => Promise<void>;
  editingApplication: JobApplication | null;
  onCancelEdit: () => void;
  onSuccess: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
}

interface ValidationErrors {
  companyName?: string;
  position?: string;
}

const initialFormState: JobApplicationCreateInput = {
  companyName: "",
  position: "",
  jobUrl: "",
  location: "",
  salaryRange: "",
  jobDescription: "",
  notes: "",
  interestLevel: null,
  technicalStack: "",
  status: JobApplicationStatus.Applied,
};

const joinTechnicalStack = (skills: string[]) => skills.join(", ");
const defaultInterestLevel = 3;

const fieldSurfaceClass = "bg-deco-surface";
const fieldCompactClass = "h-10";
const labelCompactClass =
  "text-xs font-semibold uppercase tracking-[0.12em] text-deco-muted";
const chipCompactClass =
  "deco-frame inline-flex items-center gap-1.5 border-border-gold-muted bg-deco-card px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground";

const JobApplicationForm = ({
  onCreate,
  onUpdate,
  editingApplication,
  onCancelEdit,
  onSuccess,
  submitLabel,
  submittingLabel = "Saving...",
  cancelLabel = "Cancel",
}: JobApplicationFormProps) => {
  const [form, setForm] = useState<JobApplicationCreateInput>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [technicalStackDraft, setTechnicalStackDraft] = useState("");

  useEffect(() => {
    if (editingApplication) {
      setForm({
        companyName: editingApplication.companyName,
        position: editingApplication.position,
        jobUrl: editingApplication.jobUrl ?? "",
        location: editingApplication.location ?? "",
        salaryRange: editingApplication.salaryRange ?? "",
        jobDescription: editingApplication.jobDescription ?? "",
        notes: editingApplication.notes ?? "",
        interestLevel: editingApplication.interestLevel ?? null,
        technicalStack: editingApplication.technicalStack ?? "",
        status: editingApplication.status,
      });
    } else {
      setForm(initialFormState);
    }

    setErrorMessage(null);
    setValidationErrors({});
    setTechnicalStackDraft("");
  }, [editingApplication]);

  const technicalStackSkills = splitTechStack(form.technicalStack);

  const setTechnicalStackSkills = (skills: string[]) => {
    setForm((current) => ({
      ...current,
      technicalStack: joinTechnicalStack(skills),
    }));
  };

  const addTechnicalStackSkill = () => {
    const nextSkill = technicalStackDraft.trim();

    if (!nextSkill) {
      return;
    }

    const alreadyExists = technicalStackSkills.some(
      (skill) => skill.toLowerCase() === nextSkill.toLowerCase(),
    );

    if (!alreadyExists) {
      setTechnicalStackSkills([...technicalStackSkills, nextSkill]);
    }

    setTechnicalStackDraft("");
  };

  const removeTechnicalStackSkill = (skillToRemove: string) => {
    setTechnicalStackSkills(
      technicalStackSkills.filter((skill) => skill !== skillToRemove),
    );
  };

  const handleTechnicalStackKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addTechnicalStackSkill();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedTechnicalStackDraft = technicalStackDraft.trim();
    const nextTechnicalStackSkills = trimmedTechnicalStackDraft
      ? [
          ...technicalStackSkills,
          ...(!technicalStackSkills.some(
            (skill) =>
              skill.toLowerCase() === trimmedTechnicalStackDraft.toLowerCase(),
          )
            ? [trimmedTechnicalStackDraft]
            : []),
        ]
      : technicalStackSkills;
    const nextTechnicalStack = joinTechnicalStack(nextTechnicalStackSkills);

    const nextValidationErrors: ValidationErrors = {};

    if (!form.companyName.trim()) {
      nextValidationErrors.companyName = "Company name is required.";
    }

    if (!form.position.trim()) {
      nextValidationErrors.position = "Position is required.";
    }

    if (Object.keys(nextValidationErrors).length > 0) {
      setValidationErrors(nextValidationErrors);
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);

    try {
      if (editingApplication) {
        await onUpdate(editingApplication.id, {
          companyName: form.companyName,
          position: form.position,
          jobUrl: form.jobUrl,
          location: form.location,
          salaryRange: form.salaryRange,
          jobDescription: form.jobDescription,
          notes: form.notes,
          interestLevel: form.interestLevel,
          technicalStack: nextTechnicalStack,
          status: form.status,
          dateApplied: editingApplication.dateApplied,
        });
      } else {
        await onCreate({
          ...form,
          technicalStack: nextTechnicalStack,
        });
        setForm(initialFormState);
        setTechnicalStackDraft("");
      }

      onSuccess();
    } catch (error) {
      console.error("Save job application failed:", error);
      setErrorMessage(
        "Could not save the application. Check the form and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="grid h-full min-h-0 gap-3 p-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex min-h-0 flex-col gap-1.5 lg:h-full">
        <label className="grid gap-1">
          <span className={labelCompactClass}>Company Name</span>
          <Input
            aria-label="Company Name"
            className={`${fieldSurfaceClass} ${fieldCompactClass}`}
            value={form.companyName}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, companyName: value }));
              setValidationErrors((current) => ({
                ...current,
                companyName: undefined,
              }));
            }}
            placeholder="Example: Stripe"
            required
          />
          {validationErrors.companyName ? (
            <span className="text-xs text-danger">
              {validationErrors.companyName}
            </span>
          ) : null}
        </label>

        <label className="grid gap-1">
          <span className={labelCompactClass}>Position</span>
          <Input
            aria-label="Position"
            className={`${fieldSurfaceClass} ${fieldCompactClass}`}
            value={form.position}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, position: value }));
              setValidationErrors((current) => ({
                ...current,
                position: undefined,
              }));
            }}
            placeholder="Example: Backend Engineer"
            required
          />
          {validationErrors.position ? (
            <span className="text-xs text-danger">
              {validationErrors.position}
            </span>
          ) : null}
        </label>

        <label className="grid gap-1">
          <span className={labelCompactClass}>Status</span>
          <select
            aria-label="Status"
            className={`deco-frame h-9 border-border-gold-muted ${fieldSurfaceClass} px-2.5 py-1.5 text-sm shadow-sm outline-none transition-colors focus:border-primary-gold focus:ring-2 focus:ring-primary-gold-muted`}
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: Number(event.target.value) as JobApplicationStatus,
              }))
            }
          >
            {Object.values(JobApplicationStatus)
              .filter(
                (value): value is JobApplicationStatus =>
                  typeof value === "number",
              )
              .map((value) => (
                <option key={value} value={value}>
                  {jobApplicationStatusLabels[value]}
                </option>
              ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className={labelCompactClass}>Location</span>
          <Input
            aria-label="Location"
            className={`${fieldSurfaceClass} ${fieldCompactClass}`}
            value={form.location ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                location: event.target.value,
              }))
            }
            placeholder="Remote / Essen"
          />
        </label>

        <label className="grid gap-1">
          <span className={labelCompactClass}>Salary Range</span>
          <Input
            aria-label="Salary Range"
            className={`${fieldSurfaceClass} ${fieldCompactClass}`}
            value={form.salaryRange ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                salaryRange: event.target.value,
              }))
            }
            placeholder="48k€ - 54k€"
          />
        </label>

        <label className="grid gap-1">
          <span className="flex items-center justify-between gap-3">
            <span className={labelCompactClass}>Interest Level</span>
            <span
              aria-live="polite"
              className={`deco-frame border-border-gold-muted ${fieldSurfaceClass} px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold`}
            >
              {form.interestLevel ?? defaultInterestLevel}/5
            </span>
          </span>
          <input
            aria-label="Interest Level"
            className="deco-range-slider"
            max={5}
            min={1}
            step={1}
            type="range"
            value={form.interestLevel ?? defaultInterestLevel}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                interestLevel: Number(event.target.value),
              }))
            }
          />
        </label>

        {errorMessage ? (
          <p className="deco-frame border-danger bg-danger-soft px-3 py-2 text-xs text-danger">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-auto grid gap-1 border-t border-primary-gold-muted pt-2">
          <Button
            className="h-9 w-full justify-center"
            size="sm"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? submittingLabel
              : (submitLabel ??
                (editingApplication ? "Save Changes" : "Add Application"))}
          </Button>
          <Button
            className="h-9 w-full justify-center"
            size="sm"
            variant="ghost"
            type="button"
            onClick={onCancelEdit}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-1.5 lg:h-full">
        <div className="grid gap-1.5">
          <span className={labelCompactClass}>Skills</span>
          <div className="grid gap-1.5">
            {technicalStackSkills.length > 0 ? (
              <div
                aria-label="Selected technical stack"
                className={`deco-frame flex min-h-10 flex-wrap gap-1.5 border-border-gold-muted ${fieldSurfaceClass} p-1.5`}
              >
                {technicalStackSkills.map((skill) => (
                  <span className={chipCompactClass} key={skill}>
                    {skill}
                    <button
                      aria-label={`Remove ${skill}`}
                      className="text-deco-muted transition-colors hover:text-danger focus:outline-none focus:ring-2 focus:ring-primary-gold-muted"
                      onClick={() => removeTechnicalStackSkill(skill)}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Input
              aria-label="Technical Stack"
              className={`${fieldSurfaceClass} ${fieldCompactClass}`}
              value={technicalStackDraft}
              onBlur={addTechnicalStackSkill}
              onChange={(event) => setTechnicalStackDraft(event.target.value)}
              onKeyDown={handleTechnicalStackKeyDown}
              placeholder="Type a skill and press Enter"
            />
          </div>
        </div>

        <label className="flex min-h-0 flex-1 flex-col gap-1">
          <span className={labelCompactClass}>Job Description</span>
          <Textarea
            aria-label="Job Description"
            className={`${fieldSurfaceClass} min-h-0 flex-1 resize-none`}
            value={form.jobDescription ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                jobDescription: event.target.value,
              }))
            }
            placeholder="Paste the full job post here for future reference..."
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCompactClass}>Notes</span>
          <Textarea
            aria-label="Notes"
            className={`${fieldSurfaceClass} min-h-[5.5rem] resize-none`}
            value={form.notes ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Add private notes for later reference..."
          />
        </label>
      </div>
    </form>
  );
};

export default JobApplicationForm;
