import { useState, useEffect, useRef } from "react";

export default function useSpeechRecognition(onTranscript) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onTranscript);

  // Keep callbackRef up to date with any changes to the onTranscript callback
  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (callbackRef.current) {
          callbackRef.current(transcript);
        }
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        "Speech recognition is not supported in this browser. Please use Chrome or Safari."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return {
    isListening,
    toggleListening,
    recognitionRef,
  };
}
