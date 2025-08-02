"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { useSwapStatusSSE } from '../lib/use-sse';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Zap, 
  Activity,
  RefreshCw,
  ExternalLink,
  Copy,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from './ui/use-toast';
import { formatEther } from 'ethers';

interface RealTimeSwapStatusProps {
  swapId: string;
  initialStatus?: any;
}

interface SwapStage {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp?: number;
  txHash?: string;
  error?: string;
}

export function RealTimeSwapStatus({ swapId, initialStatus }: RealTimeSwapStatusProps) {
  const { swapStatus, connected, connecting, error, retry } = useSwapStatusSSE(swapId);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [stages, setStages] = useState<SwapStage[]>([]);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  // Update current status when SSE data changes
  useEffect(() => {
    if (swapStatus) {
      setCurrentStatus(swapStatus);
      updateStages(swapStatus);
    }
  }, [swapStatus]);

  // Initialize stages based on swap status
  const updateStages = (status: any) => {
    const newStages: SwapStage[] = [
      {
        id: 'initiated',
        name: 'Swap Initiated',
        status: 'completed',
        timestamp: status.createdAt,
      },
      {
        id: 'pool_reserve',
        name: 'Pool Reserve',
        status: status.stage >= 1 ? 'completed' : 'pending',
        timestamp: status.poolReserveTime,
        txHash: status.poolReserveTx,
      },
      {
        id: 'source_lock',
        name: 'Source Token Lock',
        status: status.stage >= 2 ? 'completed' : status.stage === 1 ? 'active' : 'pending',
        timestamp: status.sourceLockTime,
        txHash: status.sourceLockTx,
        error: status.stage === 1 && status.error ? status.error : undefined,
      },
      {
        id: 'target_release',
        name: 'Target Token Release',
        status: status.stage >= 3 ? 'completed' : status.stage === 2 ? 'active' : 'pending',
        timestamp: status.targetReleaseTime,
        txHash: status.targetReleaseTx,
        error: status.stage === 2 && status.error ? status.error : undefined,
      },
      {
        id: 'ready_claim',
        name: 'Ready to Claim',
        status: status.stage >= 4 ? 'completed' : status.stage === 3 ? 'active' : 'pending',
        timestamp: status.readyClaimTime,
      },
    ];

    setStages(newStages);
  };

  const getStageIcon = (stage: SwapStage) => {
    switch (stage.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'active':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Expired</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Unknown</Badge>;
    }
  };

  const copyTxHash = async (txHash: string) => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedTx(txHash);
      toast({
        title: "Copied!",
        description: "Transaction hash copied to clipboard",
      });
      setTimeout(() => setCopiedTx(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy transaction hash",
        variant: "destructive",
      });
    }
  };

  const getProgressPercentage = () => {
    if (!currentStatus) return 0;
    const totalStages = 5;
    return Math.min((currentStatus.stage / totalStages) * 100, 100);
  };

  const getTimeRemaining = () => {
    if (!currentStatus?.expirationTime) return null;
    const now = Math.floor(Date.now() / 1000);
    const remaining = currentStatus.expirationTime - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (!currentStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading swap status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Live updates active</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600 dark:text-red-400">
                {connecting ? 'Connecting...' : 'Connection lost'}
              </span>
              <Button onClick={retry} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            ID: {swapId.slice(0, 8)}...{swapId.slice(-8)}
          </span>
        </div>
      </div>

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span>Swap Status</span>
            </CardTitle>
            {getStatusBadge(currentStatus.status)}
          </div>
          <CardDescription>
            {currentStatus.sourceToken?.symbol} → {currentStatus.targetToken?.symbol}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-gray-500">{getProgressPercentage().toFixed(0)}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          {/* Swap Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Amount</div>
              <div className="font-medium">
                {formatEther(currentStatus.sourceAmount)} {currentStatus.sourceToken?.symbol}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Expected</div>
              <div className="font-medium">
                {formatEther(currentStatus.targetAmount)} {currentStatus.targetToken?.symbol}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Gas Savings</div>
              <div className="font-medium text-green-600 dark:text-green-400">
                ~${formatEther(currentStatus.gasSavings || '0')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Time Remaining</div>
              <div className="font-medium">
                {getTimeRemaining() || 'N/A'}
              </div>
            </div>
          </div>

          <Separator />

          {/* Stage Timeline */}
          <div className="space-y-4">
            <h3 className="font-medium">Processing Stages</h3>
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-start space-x-3">
                  <div className="mt-1">
                    {getStageIcon(stage)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stage.name}</span>
                      {stage.timestamp && (
                        <span className="text-xs text-gray-500">
                          {new Date(stage.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    
                    {stage.error && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {stage.error}
                      </div>
                    )}
                    
                    {stage.txHash && (
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {stage.txHash.slice(0, 8)}...{stage.txHash.slice(-8)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyTxHash(stage.txHash!)}
                          className="h-6 w-6 p-0"
                        >
                          {copiedTx === stage.txHash ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-6 w-6 p-0"
                        >
                          <a
                            href={`https://etherscan.io/tx/${stage.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          {currentStatus.status === 'completed' && (
            <div className="flex space-x-2">
              <Button className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Claim Gaslessly
              </Button>
            </div>
          )}

          {currentStatus.status === 'failed' && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">
                    Swap Failed
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {currentStatus.error || 'The swap could not be completed.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RealTimeSwapStatus;