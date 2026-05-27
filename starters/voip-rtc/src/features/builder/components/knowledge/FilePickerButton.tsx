import type { ChangeEvent } from "react";

const KNOWLEDGE_ACCEPT =
  ".txt,.md,.pdf,.xlsx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function FilePickerButton({
  busy,
  onUpload,
}: {
  busy: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}) {
  return (
    <label className="filePicker filePickerPrimary">
      <input
        accept={KNOWLEDGE_ACCEPT}
        disabled={busy}
        multiple
        name="knowledgeDocuments"
        type="file"
        onChange={(event) => void onUpload(event)}
      />
      Téléverser des fichiers
    </label>
  );
}
