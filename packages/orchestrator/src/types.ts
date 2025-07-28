export interface SwapRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  recipient: string;
}

export interface SwapStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  fromTxHash?: string;
  toTxHash?: string;
  error?: string;
}