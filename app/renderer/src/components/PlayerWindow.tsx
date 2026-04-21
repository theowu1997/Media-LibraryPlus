import React, { useEffect, useRef, useState } from "react";
import styles from "./PlayerWindow.module.css";

export default function PlayerWindow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);

  useEffect(() => {
    // Listen for main process to send the video path
    window.desktopApi?.onPlayerSetVideo?.((path: string) => {
      setVideoPath(path);
    });
    // Request initial video path if needed
    window.desktopApi?.requestPlayerVideo?.();
  }, []);

  return (
    <div className={styles.container}>
      {videoPath ? (
        <video
          ref={videoRef}
          src={videoPath}
          controls
          autoPlay
          className={styles.video}
        />
      ) : (
        <div className={styles.noVideo}>No video loaded</div>
      )}
    </div>
  );
}
