"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Upload, Users, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/react-router";

// Helper function to split audio file into chunks
async function splitAudioIntoChunks(file: File, chunkDurationMinutes: number = 5): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const chunkDuration = chunkDurationMinutes * 60; // Convert to seconds
        const samplesPerChunk = sampleRate * chunkDuration;
        const totalSamples = audioBuffer.length;
        const numberOfChunks = Math.ceil(totalSamples / samplesPerChunk);

        const chunks: Blob[] = [];

        for (let i = 0; i < numberOfChunks; i++) {
          const start = i * samplesPerChunk;
          const end = Math.min(start + samplesPerChunk, totalSamples);
          const chunkLength = end - start;

          // Create a new buffer for this chunk
          const chunkBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            chunkLength,
            sampleRate
          );

          // Copy data for each channel
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const chunkData = chunkBuffer.getChannelData(channel);
            for (let j = 0; j < chunkLength; j++) {
              chunkData[j] = sourceData[start + j];
            }
          }

          // Convert buffer to WAV blob
          const wavBlob = await audioBufferToWav(chunkBuffer);
          chunks.push(wavBlob);
        }

        resolve(chunks);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Helper to convert AudioBuffer to WAV blob
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      data.push(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
    }
  }

  const dataLength = data.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default function ImportConversationPage() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Id<"users"> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get user's network/contacts
  const contacts = useQuery(api.network.list) || [];

  // Get selected friend details
  const selectedContact = contacts.find(c => c.contactId === selectedFriend);

  // Mutations and actions
  const generateUploadUrl = useMutation(api.conversations.generateUploadUrl);
  const createConversation = useMutation(api.conversations.create);
  const saveAudioStorageId = useMutation(api.conversations.saveAudioStorageId);
  const linkConversationToFriend = useMutation(api.conversations.linkConversationToFriend);
  const transcribeChunkOnly = useAction(api.speechmaticsBatch.transcribeChunkOnly);
  const saveTranscriptData = useMutation(api.conversations.saveTranscriptData);
  const importTextTranscript = useAction(api.conversations.importTextTranscript);

  // Get current user ID
  const currentUserData = useQuery(api.users.getCurrentUser);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's a text file (dev mode feature)
      const isTextFile = file.name.endsWith('.txt') || file.type === 'text/plain';
      
      if (!isTextFile) {
        // Validate audio file type
        const validTypes = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/m4a", "audio/mp4", "audio/webm"];
        if (!validTypes.some(type => file.type.startsWith("audio/"))) {
          toast.error("Please select an audio or text file");
          return;
        }
      }

      // Validate file size (max 100MB for audio, 10MB for text)
      const maxSize = isTextFile ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File size must be less than ${isTextFile ? '10' : '100'}MB`);
        return;
      }

      setSelectedFile(file);
      toast.success(`Selected: ${file.name}${isTextFile ? ' (text mode)' : ''}`);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select an audio or text file");
      return;
    }

    if (!selectedFriend) {
      toast.error("Please select a friend to connect this conversation with");
      return;
    }

    // Check if it's a text file
    const isTextFile = selectedFile.name.endsWith('.txt') || selectedFile.type === 'text/plain';

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Handle text file import (dev mode)
      if (isTextFile) {
        await handleTextImport();
        return;
      }

      // Handle audio file import (original flow)
      // Step 1: Create conversation
      toast.info("Creating conversation...");
      const conversation = await createConversation({
        location: "Imported Conversation",
      });
      setUploadProgress(15);

      // Step 2: Link conversation to selected friend
      toast.info("Linking conversation to friend...");
      await linkConversationToFriend({
        conversationId: conversation.id,
        friendId: selectedFriend,
      });
      setUploadProgress(20);

      // Step 3: Split audio into 10-minute chunks
      toast.info("Splitting audio into manageable chunks...");
      let audioChunks: Blob[];
      try {
        audioChunks = await splitAudioIntoChunks(selectedFile, 10);
        toast.success(`Split into ${audioChunks.length} chunk(s) of ~10 minutes each`);
      } catch (splitError) {
        console.error("Failed to split audio, using full file:", splitError);
        toast.warning("Could not split audio, processing as single file...");
        audioChunks = [selectedFile];
      }
      setUploadProgress(25);

      setIsUploading(false);
      setIsProcessing(true);

      // Step 4: Process each chunk
      const allTranscripts: Array<{ speaker: string; text: string }> = [];
      let allS1Facts: string[] = [];
      let allS2Facts: string[] = [];
      let allSummaries: string[] = [];

      for (let i = 0; i < audioChunks.length; i++) {
        const chunkNum = i + 1;
        const totalChunks = audioChunks.length;
        const chunk = audioChunks[i];

        toast.info(`Processing chunk ${chunkNum}/${totalChunks}...`);

        // Upload this chunk
        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: chunk,
        });

        if (!uploadResult.ok) {
          throw new Error(`Failed to upload chunk ${chunkNum}`);
        }

        const { storageId } = await uploadResult.json();

        // Save storage ID for the first chunk only (for playback)
        if (i === 0) {
          await saveAudioStorageId({
            conversationId: conversation.id,
            storageId: storageId as Id<"_storage">,
          });
        }

        // Transcribe this chunk (no DB save)
        toast.info(`Transcribing chunk ${chunkNum}/${totalChunks}... This may take a few minutes.`);
        const chunkResult = await transcribeChunkOnly({
          storageId: storageId as Id<"_storage">,
        });

        // Combine results
        allTranscripts.push(...chunkResult.transcript);
        allS1Facts.push(...chunkResult.S1_facts);
        allS2Facts.push(...chunkResult.S2_facts);
        allSummaries.push(chunkResult.summary);

        // Update progress
        const progress = 70 + (25 * (chunkNum / totalChunks));
        setUploadProgress(Math.round(progress));
      }

      // Step 5: Deduplicate facts
      allS1Facts = [...new Set(allS1Facts)];
      allS2Facts = [...new Set(allS2Facts)];

      // Step 6: Combine summaries
      const combinedSummary = allSummaries.length > 1
        ? `Combined conversation summary:\n\n${allSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}`
        : allSummaries[0] || "Conversation imported from audio file.";

      toast.success("All chunks processed! Saving combined results...");
      setUploadProgress(95);

      // Step 7: Map speakers to user IDs and save to database
      // S1 → current user (initiator), S2 → selected friend (scanner)
      const currentUserId = currentUserData?._id;
      if (!currentUserId) {
        throw new Error("Current user not found");
      }

      const transcriptWithUserIds = allTranscripts.map(turn => {
        // Determine user ID based on speaker
        const userId = turn.speaker === "S1" ? currentUserId : selectedFriend;

        return {
          userId: userId as Id<"users">,
          text: turn.text,
        };
      });

      // Save combined transcript data to database
      await saveTranscriptData({
        conversationId: conversation.id,
        transcript: transcriptWithUserIds,
        S1_facts: allS1Facts,
        S2_facts: allS2Facts,
        initiatorName: clerkUser?.fullName || clerkUser?.firstName || "You",
        scannerName: selectedContact?.name || "Friend",
        summary: combinedSummary,
      });

      setUploadProgress(100);
      setIsProcessing(false);

      toast.success("Conversation imported successfully!");

      // Navigate to the conversation
      setTimeout(() => {
        navigate(`/dashboard/conversations/${conversation.id}`);
      }, 1000);

    } catch (error: any) {
      console.error("Import failed:", error);
      toast.error(`Failed to import conversation: ${error.message}`);
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleTextImport = async () => {
    if (!selectedFile || !selectedFriend) return;

    try {
      // Step 1: Read text file
      toast.info("Reading text file...");
      const textContent = await selectedFile.text();
      setUploadProgress(15);

      // Step 2: Create conversation
      toast.info("Creating conversation...");
      const conversation = await createConversation({
        location: "Imported Text Transcript",
      });
      setUploadProgress(25);

      // Step 3: Link conversation to selected friend
      toast.info("Linking conversation to friend...");
      await linkConversationToFriend({
        conversationId: conversation.id,
        friendId: selectedFriend,
      });
      setUploadProgress(35);

      setIsUploading(false);
      setIsProcessing(true);

      // Step 4: Process text transcript with AI
      toast.info("Processing transcript and extracting facts...");
      const result = await importTextTranscript({
        conversationId: conversation.id,
        textContent,
        initiatorName: clerkUser?.fullName || clerkUser?.firstName || "You",
        scannerName: selectedContact?.name || "Friend",
      });
      setUploadProgress(75);

      // Step 5: Map speakers to user IDs
      const currentUserId = currentUserData?._id;
      if (!currentUserId) {
        throw new Error("Current user not found");
      }

      const transcriptWithUserIds = result.transcript.map(turn => ({
        userId: (turn.speaker === "S1" ? currentUserId : selectedFriend) as Id<"users">,
        text: turn.text,
      }));

      // Step 6: Save transcript data to database
      toast.info("Saving to database...");
      await saveTranscriptData({
        conversationId: conversation.id,
        transcript: transcriptWithUserIds,
        S1_facts: result.S1_facts,
        S2_facts: result.S2_facts,
        initiatorName: clerkUser?.fullName || clerkUser?.firstName || "You",
        scannerName: selectedContact?.name || "Friend",
        summary: result.summary,
      });

      setUploadProgress(100);
      setIsProcessing(false);

      toast.success("Text transcript imported successfully!");

      // Navigate to the conversation
      setTimeout(() => {
        navigate(`/dashboard/conversations/${conversation.id}`);
      }, 1000);

    } catch (error: any) {
      console.error("Text import failed:", error);
      toast.error(`Failed to import text transcript: ${error.message}`);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Import Conversation</h1>
              <p className="text-sm text-muted-foreground">Upload an audio file and connect it to a friend</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Step 1: Select Audio File */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Step 1: Select File</h2>
                <p className="text-sm text-muted-foreground">Upload an audio file (MP3, WAV, M4A, WEBM - max 100MB) or a text transcript (.txt - max 10MB)</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="audio-file">Audio or Text File</Label>
              <Input
                id="audio-file"
                type="file"
                accept="audio/*,.txt"
                onChange={handleFileSelect}
                disabled={isUploading || isProcessing}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Select Friend */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Step 2: Select Friend</h2>
                <p className="text-sm text-muted-foreground">Who was in this conversation with you?</p>
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You don't have any contacts yet.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard/network")}
                >
                  View Network
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {contacts.map((contact) => (
                  <button
                    key={contact.contactId}
                    onClick={() => setSelectedFriend(contact.contactId)}
                    disabled={isUploading || isProcessing}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                      selectedFriend === contact.contactId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={contact.image} />
                      <AvatarFallback>
                        {contact.name?.charAt(0) || contact.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {contact.name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.email}
                      </p>
                    </div>
                    {selectedFriend === contact.contactId && (
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Progress & Action */}
          {(isUploading || isProcessing) && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {isUploading ? "Uploading..." : "Processing audio..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isProcessing && "This may take a few minutes depending on the audio length"}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!selectedFile || !selectedFriend || isUploading || isProcessing}
            size="lg"
            className="w-full"
          >
            {isUploading || isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isUploading ? "Uploading..." : "Processing..."}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Conversation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
