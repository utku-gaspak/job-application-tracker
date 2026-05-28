import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ScoutJobCreateInput } from "../types";
import { createScoutJob } from "../api/scoutJobsApi";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface ScoutManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobsReload: () => void;
  onViewSwitch: (view: "evaluate") => void;
}

const emptyForm = {
  title: "",
  company: "",
  location: "",
  workplaceType: "",
  commitment: "",
  postedAt: "",
  jobUrl: "",
  applyUrl: "",
  technicalTools: "",
  requirementsSummary: "",
};

export const ScoutManualDialog = ({
  open,
  onOpenChange,
  onJobsReload,
  onViewSwitch,
}: ScoutManualDialogProps) => {
  const [form, setForm] = useState(emptyForm);
  const [isActing, setIsActing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const title = form.title.trim();
    const company = form.company.trim();

    if (!title || !company) {
      setErrorMessage("Title and company are required for manual scout entries.");
      return;
    }

    const payload: ScoutJobCreateInput = {
      title,
      company,
      location: form.location.trim() || null,
      workplaceType: form.workplaceType.trim() || null,
      commitment: form.commitment.trim() || null,
      postedAt: form.postedAt || null,
      jobUrl: form.jobUrl.trim() || null,
      applyUrl: form.applyUrl.trim() || null,
      technicalTools: form.technicalTools.trim() || null,
      requirementsSummary: form.requirementsSummary.trim() || null,
    };

    try {
      setIsActing(true);
      setErrorMessage(null);
      await createScoutJob(payload);
      toast.success("Scout job added manually.");
      setForm(emptyForm);
      onOpenChange(false);
      onJobsReload();
      onViewSwitch("evaluate");
    } catch {
      setErrorMessage("Could not add the scout job manually.");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,65rem)] overflow-y-auto lg:overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manually add scout job</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 pt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Senior Backend Engineer"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Company *
              </label>
              <Input
                value={form.company}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    company: event.target.value,
                  }))
                }
                placeholder="Acme GmbH"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Location
              </label>
              <Input
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Remote / Berlin"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Workplace type
              </label>
              <Input
                value={form.workplaceType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    workplaceType: event.target.value,
                  }))
                }
                placeholder="Hybrid"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Commitment
              </label>
              <Input
                value={form.commitment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    commitment: event.target.value,
                  }))
                }
                placeholder="Full-time"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Posted date
              </label>
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postedAt: event.target.value,
                  }))
                }
                value={form.postedAt}
                type="date"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Job URL
              </label>
              <Input
                value={form.jobUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    jobUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Apply URL
              </label>
              <Input
                value={form.applyUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    applyUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-1 lg:col-span-2">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Technical tools
              </label>
              <Input
                value={form.technicalTools}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    technicalTools: event.target.value,
                  }))
                }
                placeholder="React, .NET, PostgreSQL"
              />
            </div>

            <div className="grid gap-1 lg:col-span-2">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary-gold">
                Requirements summary
              </label>
              <Textarea
                className="min-h-32"
                value={form.requirementsSummary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requirementsSummary: event.target.value,
                  }))
                }
                placeholder="Notes, requirements, or scout observations..."
              />
            </div>
          </div>

          {errorMessage ? (
            <p className="mt-3 deco-frame border-danger bg-danger-soft px-3 py-2 text-[0.68rem] text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <Button
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isActing}
              onClick={() => void handleSubmit()}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add scout job
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
