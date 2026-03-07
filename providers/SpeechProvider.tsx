import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import React, {
  createContext, useCallback,
  useContext, useMemo, useRef,
  useState, type ReactNode
} from "react";

export interface SpeechContextValue {
  playAudio: (source: string) => Promise<void>;
  speakText: (
    text: string,
    options?: { language?: string; rate?: number }
  ) => void;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
}

const SpeechContext = createContext<SpeechContextValue | undefined>(undefined);

export function SpeechProvider({ children }: { children: ReactNode }) {
  const audioPlayer = useAudioPlayer(undefined, {
    keepAudioSessionActive: false,
  });
  const status = useAudioPlayerStatus(audioPlayer);

  const isSpeakingRef = useRef(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);

  const stopAll = useCallback(() => {
    audioPlayer.pause();
    Speech.stop();
    isSpeakingRef.current = false;
    setIsSpeakingState(false);
  }, [audioPlayer]);

  const playAudio = useCallback(
    async (source: string) => {
      if (isSpeakingRef.current) {
        Speech.stop();
        isSpeakingRef.current = false;
        setIsSpeakingState(false);
      }
      audioPlayer.replace(source);
      if (audioPlayer.isLoaded) {
        audioPlayer.play();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          sub.remove();
          reject(new Error("Audio load timed out"));
        }, 5000);
        const sub = audioPlayer.addListener("playbackStatusUpdate", (s) => {
          if (s.isLoaded) {
            clearTimeout(timeout);
            sub.remove();
            audioPlayer.play();
            resolve();
          }
        });
      });
    },
    [audioPlayer]
  );

  const speakText = useCallback(
    (text: string, options?: { language?: string; rate?: number }) => {
      audioPlayer.pause();
      if (isSpeakingRef.current) {
        Speech.stop();
      }
      isSpeakingRef.current = true;
      setIsSpeakingState(true);
      Speech.speak(text, {
        language: options?.language || "ja",
        rate: options?.rate,
        onDone: () => {
          isSpeakingRef.current = false;
          setIsSpeakingState(false);
        },
        onStopped: () => {
          isSpeakingRef.current = false;
          setIsSpeakingState(false);
        },
        onError: () => {
          isSpeakingRef.current = false;
          setIsSpeakingState(false);
        },
      });
    },
    [audioPlayer]
  );

  const pause = useCallback(() => {
    if (isSpeakingRef.current) {
      Speech.pause();
    } else {
      audioPlayer.pause();
    }
  }, [audioPlayer]);

  const resume = useCallback(async () => {
    if (isSpeakingRef.current) {
      Speech.resume();
    } else {
      await audioPlayer.play();
    }
  }, [audioPlayer]);

  const isPlaying = status.playing || isSpeakingState;

  const contextValue = useMemo<SpeechContextValue>(
    () => ({
      playAudio,
      speakText,
      pause,
      resume,
      stop: stopAll,
      isPlaying,
    }),
    [playAudio, speakText, pause, resume, stopAll, isPlaying]
  );

  return (
    <SpeechContext.Provider value={contextValue}>
      {children}
    </SpeechContext.Provider>
  );
}

export function useSpeech(): SpeechContextValue {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useSpeech must be used within SpeechProvider");
  }
  return context;
}
