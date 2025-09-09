import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Video, Square, Send, Trash2, Upload } from 'lucide-react';

interface AudioVideoMessageProps {
  userLocation?: { lat: number; lng: number } | null;
}

const AudioVideoMessage: React.FC<AudioVideoMessageProps> = ({ userLocation }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const constraints = type === 'video' 
        ? { video: { width: 1280, height: 720 }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: type === 'video' ? 'video/webm;codecs=vp9' : 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { 
          type: type === 'video' ? 'video/webm' : 'audio/webm' 
        });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        
        // Stop and clean up stream
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingType(type);
      startTimer();

      toast({
        title: "Recording Started",
        description: `${type === 'video' ? 'Video' : 'Audio'} recording has begun`,
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please check your camera/microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();

      toast({
        title: "Recording Stopped",
        description: "Your message has been recorded successfully",
      });
    }
  };

  const uploadMediaToStorage = async (mediaBlob: Blob, type: 'audio' | 'video'): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const timestamp = Date.now();
      const fileExtension = type === 'video' ? 'webm' : 'webm';
      const fileName = `emergency_${type}_${timestamp}.${fileExtension}`;
      const filePath = `${user.id}/emergency_media/${fileName}`;

      console.log('Uploading media:', { fileName, filePath, size: mediaBlob.size });

      const { data, error } = await supabase.storage
        .from('emergency-media')
        .upload(filePath, mediaBlob, {
          contentType: type === 'video' ? 'video/webm' : 'audio/webm',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('emergency-media')
        .getPublicUrl(filePath);

      console.log('Public URL:', urlData.publicUrl);
      
      toast({
        title: "Upload Successful",
        description: "Media file uploaded successfully",
      });

      return urlData.publicUrl;

    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload media file",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const sendEmergencyMessage = async () => {
    if (!recordedBlob || !recordingType) return;

    try {
      setIsSending(true);

      // Upload media file first
      const mediaUrl = await uploadMediaToStorage(recordedBlob, recordingType);
      
      if (!mediaUrl) {
        throw new Error('Failed to upload media file');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Send emergency notification with media URL
      const { data, error } = await supabase.functions.invoke('send-emergency-notification', {
        body: {
          user_id: user.id,
          latitude: userLocation?.lat || null,
          longitude: userLocation?.lng || null,
          message: `Emergency ${recordingType} message recorded! Please check the attached ${recordingType} for details.`,
          media_url: mediaUrl
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Emergency Alert Sent",
        description: `Emergency ${recordingType} message sent to all contacts`,
      });

      clearRecording();

    } catch (error: any) {
      console.error('Error sending emergency message:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send emergency message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const clearRecording = () => {
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordingType(null);
    setRecordingTime(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mic className="h-5 w-5 mr-2 text-primary" />
          Quick Emergency Message
        </CardTitle>
        <CardDescription>
          Record a quick audio or video message to send to your emergency contacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Recording Controls */}
        {!isRecording && !recordedBlob && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => startRecording('audio')}
              className="flex-1"
            >
              <Mic className="h-4 w-4 mr-2" />
              Record Audio
            </Button>
            <Button
              variant="outline"
              onClick={() => startRecording('video')}
              className="flex-1"
            >
              <Video className="h-4 w-4 mr-2" />
              Record Video
            </Button>
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-red-100 rounded-full">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-700 font-medium">
                  Recording {recordingType} - {formatTime(recordingTime)}
                </span>
              </div>
            </div>

            {recordingType === 'video' && (
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full max-w-sm mx-auto rounded-lg"
                  muted
                  playsInline
                />
              </div>
            )}

            <Button
              variant="destructive"
              onClick={stopRecording}
              className="w-full"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          </div>
        )}

        {/* Playback and Send */}
        {recordedBlob && recordedUrl && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {recordingType === 'video' ? 'Video' : 'Audio'} message recorded ({formatTime(recordingTime)})
              </p>
              
              {recordingType === 'video' ? (
                <video
                  src={recordedUrl}
                  controls
                  className="w-full max-w-sm mx-auto rounded-lg"
                />
              ) : (
                <div className="bg-muted rounded-lg p-4">
                  <audio src={recordedUrl} controls className="w-full" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearRecording}
                className="flex-1"
                disabled={isUploading || isSending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button
                variant="destructive"
                onClick={sendEmergencyMessage}
                className="flex-1"
                disabled={isUploading || isSending}
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : isSending ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Emergency Alert
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">Quick Emergency Message:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Record a brief message describing your situation</li>
            <li>The message will be uploaded and sent to all emergency contacts</li>
            <li>Keep messages under 30 seconds for faster delivery</li>
            <li>Include your location and what help you need</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioVideoMessage;
