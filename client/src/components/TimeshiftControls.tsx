import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Radio,
  Clock,
  Calendar,
  Loader2
} from "lucide-react";
import {
  useTimeshiftPosition,
  useStartTimeshift,
  useStopTimeshift,
  useTimeshiftSeek,
  useWatchFromStart,
  useGoLive,
  type TimeshiftPosition
} from "@/hooks/use-timeshift";
import { formatDistanceToNow } from "date-fns";

interface TimeshiftControlsProps {
  streamId: number;
  streamName: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export function TimeshiftControls({ 
  streamId, 
  streamName, 
  isPlaying = false,
  onTogglePlay 
}: TimeshiftControlsProps) {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { data: position, isLoading } = useTimeshiftPosition(streamId, true);
  const startTimeshift = useStartTimeshift();
  const stopTimeshift = useStopTimeshift();
  const seek = useTimeshiftSeek();
  const watchFromStart = useWatchFromStart();
  const goLive = useGoLive();

  // Update current position from server
  useEffect(() => {
    if (position && !isDragging) {
      setCurrentPosition(position.position);
    }
  }, [position, isDragging]);

  const handleSeek = (value: number[]) => {
    const newPosition = value[0];
    setCurrentPosition(newPosition);
    setIsDragging(false);
    seek.mutate({ streamId, position: newPosition });
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentPosition(value[0]);
    setIsDragging(true);
  };

  const handleWatchFromStart = () => {
    watchFromStart.mutate(streamId);
  };

  const handleGoLive = () => {
    goLive.mutate(streamId);
  };

  const handleSkipBack = () => {
    const newPosition = Math.max(0, currentPosition - 30);
    seek.mutate({ streamId, position: newPosition });
  };

  const handleSkipForward = () => {
    if (!position) return;
    const newPosition = Math.min(position.availableRange.end, currentPosition + 30);
    seek.mutate({ streamId, position: newPosition });
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const isLive = position && Math.abs(currentPosition - position.availableRange.end) < 5;
  const bufferDuration = position ? position.availableRange.end - position.availableRange.start : 0;

  if (isLoading) {
    return (
      <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading timeshift data...</span>
        </div>
      </Card>
    );
  }

  if (!position) {
    return (
      <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Timeshift & Catchup</h3>
            <p className="text-sm text-muted-foreground">
              Start timeshift to enable watch-from-start and seeking
            </p>
          </div>
          <Button
            onClick={() => startTimeshift.mutate(streamId)}
            disabled={startTimeshift.isPending}
            className="btn-primary"
          >
            {startTimeshift.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Enable Timeshift
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
            <Clock className="w-5 h-5 text-primary" />
            Timeshift Controls
          </h3>
          <p className="text-sm text-muted-foreground">{streamName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-500">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
              <Calendar className="w-3 h-3 text-blue-500" />
              <span className="text-xs font-medium text-blue-500">
                {formatDistanceToNow(new Date(position.timestamp), { addSuffix: true })}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => stopTimeshift.mutate(streamId)}
            disabled={stopTimeshift.isPending}
          >
            Stop Timeshift
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[currentPosition]}
            onValueChange={handleSliderChange}
            onValueCommit={handleSeek}
            min={position.availableRange.start}
            max={position.availableRange.end}
            step={1}
            className="w-full"
            data-testid="timeshift-slider"
          />
          
          {/* Time Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(position.availableRange.start)}</span>
            <span className="text-white font-medium">{formatTime(currentPosition)}</span>
            <span>{formatTime(position.availableRange.end)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleWatchFromStart}
            disabled={currentPosition === 0}
            title="Watch from start"
            data-testid="button-watch-from-start"
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipBack}
            disabled={currentPosition <= position.availableRange.start}
            title="Skip back 30s"
          >
            <SkipBack className="w-4 h-4" />
            <span className="text-xs ml-1">30s</span>
          </Button>

          <Button
            size="lg"
            onClick={onTogglePlay}
            className="btn-primary h-12 w-12 rounded-full"
            data-testid="button-toggle-play"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipForward}
            disabled={currentPosition >= position.availableRange.end}
            title="Skip forward 30s"
          >
            <span className="text-xs mr-1">30s</span>
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleGoLive}
            disabled={isLive}
            title="Go to live"
            className={isLive ? "" : "border-red-500/30 text-red-500 hover:bg-red-500/10"}
            data-testid="button-go-live"
          >
            <Radio className="w-4 h-4" />
          </Button>
        </div>

        {/* Buffer Info */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>
            Buffer: <span className="text-white font-medium">{formatTime(bufferDuration)}</span>
          </span>
          <span className="text-white/20">•</span>
          <span>
            Position: <span className="text-white font-medium">{formatTime(currentPosition)}</span>
          </span>
          <span className="text-white/20">•</span>
          <span>
            Available: <span className="text-white font-medium">
              {formatTime(position.availableRange.start)} - {formatTime(position.availableRange.end)}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
