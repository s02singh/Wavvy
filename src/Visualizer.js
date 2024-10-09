import React, { useEffect, useRef, useState } from 'react';
import Sketch from 'react-p5';

export default function Visualizer({ audioFile, onBack }) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  let screenShakeIntensity = 0;

  const spherePositions = useRef([]);

  // State variables for media player
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Handles full-screen toggle
  const handleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  // Sets up audio context and analyser for audio processing
  useEffect(() => {
    let audioElement;
    let isMounted = true;

    const setupAudioContext = async (audioSrc) => {
      if (!audioSrc) return;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioElement = new Audio(audioSrc);
      audioElement.crossOrigin = 'anonymous';

      audioElement.addEventListener('loadedmetadata', () => {
        if (isMounted) {
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContext.createMediaElementSource(audioElement);
          source.connect(analyser);
          analyser.connect(audioContext.destination);

          analyserRef.current = analyser;
          audioContextRef.current = audioContext;
          audioElementRef.current = audioElement;

          setDuration(audioElement.duration);

          if (spherePositions.current.length === 0) {
            for (let i = 0; i < 50; i++) {
              spherePositions.current.push({
                x: 0,
                y: 0,
                z: 0,
                originalX: 0,
                originalY: 0,
                originalZ: 0,
              });
            }
          }

          audioElement.play().catch((error) => {
            console.error("Failed to play the audio:", error);
          });

          audioElement.addEventListener('timeupdate', () => {
            setCurrentTime(audioElement.currentTime);
          });

          audioElement.addEventListener('ended', () => {
            setIsPlaying(false);
          });
        }
      });
    };

    if (audioFile) {
      setupAudioContext(audioFile);
    }

    return () => {
      isMounted = false;
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, [audioFile]);

  // Handles play/pause toggle
  const handlePlayPause = () => {
    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Skips 10 seconds forward
  const handleForward = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.min(audioElementRef.current.currentTime + 10, duration);
    }
  };

  // Skips 10 seconds backward
  const handleBackward = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.max(audioElementRef.current.currentTime - 10, 0);
    }
  };

  // Scrubs through the audio
  const handleScrub = (e) => {
    const scrubTime = (e.target.value / 100) * duration;
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = scrubTime;
    }
  };

  // Formats time in minutes:seconds
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60) || 0;
    const seconds = Math.floor(time % 60) || 0;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Sets up the canvas for visual rendering
  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight, p5.WEBGL).parent(canvasParentRef);
    p5.noStroke();
    p5.colorMode(p5.HSB);

    p5.ambientLight(100, 100, 100);
    p5.directionalLight(255, 255, 255, 0.25, 0.25, -1);
  };

  // Handles drawing the visual elements on the canvas
  const draw = (p5) => {
    p5.clear();

    let lowAvg = 0;
    let midAvg = 0;
    let highAvg = 0;
    let totalAvg = 0;
    let hue = 0;

    p5.translate(0, 0, -750);

    let dataArray = [];
    const bufferLength = 128;

    if (analyserRef.current) {
      const analyser = analyserRef.current;
      const actualBufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(actualBufferLength);
      analyser.getByteFrequencyData(dataArray);

      const lowFreq = dataArray.slice(0, actualBufferLength / 3);
      const midFreq = dataArray.slice(actualBufferLength / 3, (actualBufferLength / 3) * 2);
      const highFreq = dataArray.slice((actualBufferLength / 3) * 2);

      lowAvg = lowFreq.reduce((sum, value) => sum + value, 0) / lowFreq.length;
      midAvg = midFreq.reduce((sum, value) => sum + value, 0) / midFreq.length;
      highAvg = highFreq.reduce((sum, value) => sum + value, 0) / highFreq.length;

      totalAvg = (lowAvg + midAvg + highAvg) / 3;

      hue = p5.map(midAvg, 0, 255, 0, 360);
    } else {
      dataArray = new Uint8Array(bufferLength).fill(0);
    }

    const bgHue = hue;
    const bgSaturation = p5.map(totalAvg, 0, 255, 20, 80);
    const bgBrightness = p5.map(totalAvg, 0, 255, 10, 50);

    p5.background(bgHue, bgSaturation, bgBrightness);

    p5.orbitControl();

    if (lowAvg > 180) {
      screenShakeIntensity = p5.map(lowAvg, 180, 255, 0, 20);
      p5.translate(
        p5.random(-screenShakeIntensity, screenShakeIntensity),
        p5.random(-screenShakeIntensity, screenShakeIntensity)
      );
    } else {
      screenShakeIntensity = 0;
    }

    const bassVibration = p5.map(lowAvg, 0, 255, 0.2, 1);

    // Draw central bass sphere
    p5.push();
    p5.fill(hue, 100, 100, 0.8);
    const bassSize = p5.map(lowAvg, 0, 255, 100, 400);
    p5.scale(1 + p5.sin(p5.frameCount * bassVibration) * 0.03);
    p5.sphere(bassSize || 100);
    p5.pop();

    if (lowAvg > 1) {
      p5.pointLight(255, 255, 255, 0, 0, 500);
      p5.ambientLight(255);
    } else {
      p5.ambientLight(100);
    }

    spherePositions.current.forEach((sphere) => {
      if (lowAvg > 180) {
        sphere.x += (sphere.x - sphere.originalX) * 0.05;
        sphere.y += (sphere.y - sphere.originalY) * 0.05;
        sphere.z += (sphere.z - sphere.originalZ) * 0.05;
      } else {
        sphere.x += (sphere.originalX - sphere.x) * 0.05;
        sphere.y += (sphere.originalY - sphere.y) * 0.05;
        sphere.z += (sphere.originalZ - sphere.z) * 0.05;
      }
    });

    p5.push();
    spherePositions.current.forEach((sphere) => {
      p5.push();
      p5.translate(sphere.x, sphere.y, sphere.z);
      p5.fill(100, 100, 255);
      p5.sphere(10);
      p5.pop();
    });
    p5.pop();

    p5.push();
    p5.rotateX(p5.frameCount * 0.005);
    p5.rotateY(p5.frameCount * 0.005);
    const gridSize = 30;
    for (let x = -p5.width / 2; x < p5.width / 2; x += gridSize) {
      for (let y = -p5.height / 2; y < p5.height / 2; y += gridSize) {
        const d = p5.dist(x, y, 0, 0);
        const offset = p5.map(d, 0, p5.width / 2, -p5.PI, p5.PI);

        const wave = p5.sin(p5.frameCount * 0.02 + offset) * p5.map(midAvg + highAvg, 0, 510, 0, 200);

        p5.push();
        p5.translate(x, y, wave || 0);

        const sphereSize = p5.map(highAvg, 0, 255, 5, 20) || 5;

        const sphereHue = (hue + offset * 50) % 360;
        const sphereSaturation = p5.map(lowAvg, 0, 255, 50, 100) || 50;
        const sphereBrightness = p5.map(highAvg, 0, 255, 50, 100) || 50;

        p5.fill(sphereHue, sphereSaturation, sphereBrightness);
        p5.sphere(sphereSize);
        p5.pop();
      }
    }
    p5.pop();

    p5.push();
    const radius = p5.height / 3;
    const angleStep = (Math.PI * 2) / 64;

    for (let i = 0; i < 64; i++) {
      const dataIdx = i * 2;
      const amplitude = dataArray[dataIdx] || 0;
      const mappedAmplitude = p5.map(amplitude, 0, 255, 0, radius);
      const angle = angleStep * i;

  
      const z = -500;

      p5.push();
      p5.translate(0, 0, z);
      p5.rotateZ(angle);
      p5.fill((hue + i * 5) % 360, 80, 100);
      p5.rectMode(p5.CORNER);
      p5.noStroke();
      p5.rect(radius, -5, mappedAmplitude, 10);
      p5.pop();
    }
    p5.pop();
  };

  return (
    <div>
      <button onClick={onBack} className="back-button">
        Back
      </button>
      <button onClick={handleFullscreen} className="fullscreen-button">
        Toggle Fullscreen
      </button>
      <Sketch setup={setup} draw={draw} />

      <div className="media-player">
        <div className="controls">
          <button onClick={handleBackward} className="media-button">⏪</button>
          <button onClick={handlePlayPause} className="media-button">
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <button onClick={handleForward} className="media-button">⏩</button>
        </div>
        <div className="time-info">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={(currentTime / duration) * 100 || 0}
            onChange={handleScrub}
            className="scrubber"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
