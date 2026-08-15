import { UploadZone } from '@/components/ui/upload-zone';

const noop = () => {};

// A plain object shaped like a File is enough for the preview renderer —
// UploadZone only reads .name and .size off the `file` prop.
const resumeFile = {
  name: 'Harsha_Kolluru_Resume_2026.pdf',
  size: 214_500,
} as File;

export function Idle() {
  return (
    <div style={{ width: 420 }}>
      <UploadZone onFileSelect={noop} accept=".pdf,.docx" maxSize={5 * 1024 * 1024} />
    </div>
  );
}

export function Uploaded() {
  return (
    <div style={{ width: 420 }}>
      <UploadZone onFileSelect={noop} file={resumeFile} onRemove={noop} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ width: 420 }}>
      <UploadZone onFileSelect={noop} disabled />
    </div>
  );
}
