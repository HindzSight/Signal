export type TransferStatus = "active" | "completed" | "cancelled";

export interface Transfer {
  id: string;
  file: string;
  size: number;
  bytesSent: number;
  percent: number;
  speed: number;
  status: TransferStatus;
  startedAt: number;
}

export type ShareStatus = "starting" | "active";

export interface Share {
  id: string;
  name: string;
  url: string | null;
  expiresAt: number;
  status: ShareStatus;
  transfers: Transfer[];
}

export interface CreateShareResult {
  share: Share;
  passcode: string;
}

export interface Credentials {
  url: string | null;
  passcode: string;
}
