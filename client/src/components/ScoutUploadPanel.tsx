import { FileUp } from "lucide-react";
import type { ScoutUploadResult } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ScoutUploadPanelProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  isUploading: boolean;
  uploadResult: ScoutUploadResult | null;
  onUpload: () => void;
}

export const ScoutUploadPanel = ({
  selectedFile,
  onFileSelect,
  isUploading,
  uploadResult,
  onUpload,
}: ScoutUploadPanelProps) => (
  <Card data-tour-id="scout-upload-panel">
    <CardHeader>
      <CardTitle>Upload jobs.json</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4">
      <label className="deco-frame flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-3 border-border-gold-muted bg-deco-surface-soft p-4 text-center transition-colors hover:bg-primary-gold-muted sm:min-h-[10rem] sm:p-6">
        <FileUp className="h-8 w-8 text-primary-gold" />
        <span className="text-sm text-deco-foreground">
          {selectedFile?.name ?? "Choose a hiring-cafe-scout jobs.json file"}
        </span>
        <input
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) =>
            onFileSelect(event.target.files?.[0] ?? null)
          }
          type="file"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          disabled={isUploading}
          onClick={() => void onUpload()}
          type="button"
        >
          <FileUp className="h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Scout File"}
        </Button>

        {uploadResult ? (
          <p className="text-sm text-deco-muted">
            {uploadResult.imported} imported, {uploadResult.skipped} skipped
          </p>
        ) : null}
      </div>
    </CardContent>
  </Card>
);
