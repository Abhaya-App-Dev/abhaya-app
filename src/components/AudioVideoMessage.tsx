import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Video, Square, Send, Trash2, Upload, Trash } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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

  // Recipient Selection States
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);

  // Storage Manager States
  const [storedRecordings, setStoredRecordings] = useState<any[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [isDeletingRecording, setIsDeletingRecording] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStoredRecordings();
  }, []);

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

  // Fetch recordings list from Supabase Storage
  const fetchStoredRecordings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setIsLoadingRecordings(true);
      const folderPath = `${user.id}/emergency_media`;

      const { data, error } = await supabase.storage
        .from('emergency-media')
        .list(folderPath, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error listing storage files:', error);
        return;
      }

      if (data) {
        const recordings = data
          .filter(file => file.name !== '.emptyFolderPlaceholder')
          .map(file => {
            const filePath = `${folderPath}/${file.name}`;
            const { data: urlData } = supabase.storage
              .from('emergency-media')
              .getPublicUrl(filePath);

            return {
              name: file.name,
              created_at: file.created_at,
              size: file.metadata?.size || 0,
              publicUrl: urlData.publicUrl,
              type: file.name.includes('video') ? 'video' : 'audio'
            };
          });
        setStoredRecordings(recordings);
      }
    } catch (err) {
      console.error('Failed to load recordings:', err);
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  // Delete a recording from Supabase Storage
  const deleteStoredRecording = async (fileName: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this recording from storage?")) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setIsDeletingRecording(fileName);
      const filePath = `${user.id}/emergency_media/${fileName}`;

      const { error } = await supabase.storage
        .from('emergency-media')
        .remove([filePath]);

      if (error) throw error;

      toast({
        title: "Recording Deleted",
        description: "The media file was successfully removed.",
      });

      // Refresh recordings list
      fetchStoredRecordings();
    } catch (err: any) {
      console.error('Error deleting file:', err);
      toast({
        title: "Deletion Failed",
        description: err.message || "Failed to delete file from storage.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingRecording(null);
    }
  };

  const uploadMediaToStorage = async (mediaBlob: Blob, type: 'audio' | 'video'): Promise<string> => {
    setIsUploading(true);
    try {
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

      return urlData.publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const openRecipientDialog = async () => {
    if (!recordedBlob || !recordingType) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch emergency contacts
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Contacts Found",
          description: "Please add emergency contacts in the 'Trusted Circle' tab first.",
          variant: "destructive",
        });
        return;
      }

      setContacts(data);
      // Select all by default
      setSelectedContactIds(data.map(c => c.id));
      setIsRecipientDialogOpen(true);

    } catch (err: any) {
      console.error('Error preparing alert sending:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to retrieve emergency contacts.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map(c => c.id));
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const sendEmergencyMessage = async () => {
    if (!recordedBlob || !recordingType) return;
    if (selectedContactIds.length === 0) {
      toast({
        title: "No Recipients Selected",
        description: "Please select at least one contact to receive the alert.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRecipientDialogOpen(false);
      setIsSending(true);

      // Upload media file first
      const mediaUrl = await uploadMediaToStorage(recordedBlob, recordingType);

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
          media_url: mediaUrl,
          contact_ids: selectedContactIds
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Emergency Alert Sent",
        description: `Emergency ${recordingType} message sent to selected contacts`,
      });

      clearRecording();
      // Re-fetch storage recordings
      fetchStoredRecordings();

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
    <div className="space-y-6">
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
                  onClick={openRecipientDialog}
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

      {/* Recipient Selection Dialog */}
      <Dialog open={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Recipients</DialogTitle>
            <DialogDescription>
              Choose which emergency contacts should receive this alert.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[300px] overflow-y-auto">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Select All ({contacts.length})
              </label>
            </div>
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-lg transition-colors">
                  <Checkbox
                    id={contact.id}
                    checked={selectedContactIds.includes(contact.id)}
                    onCheckedChange={() => handleContactToggle(contact.id)}
                  />
                  <label
                    htmlFor={contact.id}
                    className="flex-1 text-sm font-medium leading-none cursor-pointer flex flex-col space-y-1"
                  >
                    <span className="font-semibold">{contact.name}</span>
                    <span className="text-xs text-muted-foreground">{contact.phone} {contact.email ? `• ${contact.email}` : ''}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsRecipientDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={sendEmergencyMessage}
              disabled={selectedContactIds.length === 0 || isSending}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Alert ({selectedContactIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloud Recordings Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-indigo-600 dark:text-indigo-400">
            <Upload className="h-5 w-5 mr-2" />
            Manage Recordings
          </CardTitle>
          <CardDescription>
            Play and manage your uploaded emergency media files directly in Supabase storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingRecordings ? (
            <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
              <Upload className="h-6 w-6 animate-spin mb-2" />
              <span>Syncing with Supabase storage...</span>
            </div>
          ) : storedRecordings.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-lg">
              No cloud recordings found. Send an alert to upload your first proof.
            </div>
          ) : (
            <div className="space-y-4 divide-y divide-border">
              {storedRecordings.map((recording, idx) => (
                <div key={recording.name} className={`pt-4 ${idx === 0 ? 'pt-0' : ''} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold capitalize flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${recording.type === 'video' ? 'bg-purple-500' : 'bg-indigo-500'}`} />
                        {recording.type} Recording
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Uploaded: {new Date(recording.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} • {(recording.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteStoredRecording(recording.name)}
                      disabled={isDeletingRecording === recording.name}
                    >
                      {isDeletingRecording === recording.name ? (
                        <Upload className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {recording.type === 'video' ? (
                    <div className="relative max-w-sm">
                      <video
                        src={recording.publicUrl}
                        controls
                        className="w-full rounded-lg border bg-black max-h-[200px]"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-2 max-w-sm">
                      <audio src={recording.publicUrl} controls className="w-full" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioVideoMessage;
