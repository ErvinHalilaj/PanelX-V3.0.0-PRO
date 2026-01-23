import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Wifi, 
  Loader2,
  CheckCircle2,
  Monitor
} from "lucide-react";
import {
  useABRSession,
  useStartABR,
  useStopABR,
  type QualityVariant
} from "@/hooks/use-abr";

interface QualitySelectorProps {
  streamId: number;
  streamName: string;
  onQualityChange?: (quality: string) => void;
}

export function QualitySelector({ 
  streamId, 
  streamName, 
  onQualityChange 
}: QualitySelectorProps) {
  const [selectedQuality, setSelectedQuality] = useState<string>("auto");
  
  const { data: session, isLoading } = useABRSession(streamId, true);
  const startABR = useStartABR();
  const stopABR = useStopABR();

  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
    onQualityChange?.(quality);
  };

  const handleStartABR = () => {
    startABR.mutate({ streamId });
  };

  const handleStopABR = () => {
    stopABR.mutate(streamId);
  };

  const formatBandwidth = (bandwidth: number): string => {
    const mbps = (bandwidth * 8) / 1000000;
    return `${mbps.toFixed(1)} Mbps`;
  };

  const getQualityColor = (label: string): string => {
    switch (label) {
      case '1080p': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case '720p': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case '480p': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case '360p': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading quality options...</span>
        </div>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Adaptive Bitrate (ABR)
            </h3>
            <p className="text-sm text-muted-foreground">
              Enable multi-quality streaming for adaptive playback
            </p>
          </div>
          <Button
            onClick={handleStartABR}
            disabled={startABR.isPending}
            className="btn-primary"
            data-testid="button-start-abr"
          >
            {startABR.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Enable ABR
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Quality Settings
          </h3>
          <p className="text-sm text-muted-foreground">{streamName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            ABR Active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopABR}
            disabled={stopABR.isPending}
          >
            Disable
          </Button>
        </div>
      </div>

      {/* Quality Selector */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white mb-2 block">
            Select Quality
          </label>
          <Select value={selectedQuality} onValueChange={handleQualityChange}>
            <SelectTrigger className="w-full bg-white/5 border-white/10" data-testid="select-quality">
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  <span>Auto (Adaptive)</span>
                </div>
              </SelectItem>
              {session.variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.label} data-testid={`quality-${variant.label}`}>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span>{variant.label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({variant.resolution})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Available Qualities Grid */}
        <div>
          <label className="text-sm font-medium text-white mb-2 block">
            Available Qualities
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {session.variants.map((variant) => (
              <div
                key={variant.id}
                className={`p-3 rounded-lg border ${getQualityColor(variant.label)} ${
                  selectedQuality === variant.label ? 'ring-2 ring-primary' : ''
                } cursor-pointer transition-all hover:scale-105`}
                onClick={() => handleQualityChange(variant.label)}
                data-testid={`variant-${variant.label}`}
              >
                <div className="text-center">
                  <div className="text-lg font-bold mb-1">{variant.label}</div>
                  <div className="text-xs opacity-80 mb-2">{variant.resolution}</div>
                  <div className="text-xs font-mono">
                    <div>{variant.videoBitrate} video</div>
                    <div>{variant.audioBitrate} audio</div>
                  </div>
                  <div className="text-xs mt-2 opacity-60">
                    {formatBandwidth(variant.bandwidth)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Selection Info */}
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-white">
                Current Quality:
              </span>
            </div>
            <Badge variant="outline" className={getQualityColor(selectedQuality)}>
              {selectedQuality === 'auto' ? 'Auto (Adaptive)' : selectedQuality}
            </Badge>
          </div>
          {selectedQuality === 'auto' && (
            <p className="text-xs text-muted-foreground mt-2">
              Quality will automatically adjust based on your network speed
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
