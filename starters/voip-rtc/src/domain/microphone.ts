export interface MicrophoneDiagnosticReport {
  secureContext: boolean;
  mediaDevices: boolean;
  permission: string;
  audioInputCount: number;
  audioInputs: string[];
  testStatus: "idle" | "ok" | "error";
  errorName?: string;
  errorMessage?: string;
}
