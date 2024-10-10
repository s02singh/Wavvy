import React, { useEffect, useRef, useState } from 'react';
import Sketch from 'react-p5';

export default function Visualizer({ audioFile, onBack }) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);

  const spherePositions = useRef([]);

  const cameraRef = useRef(null);
  const canvasRef = useRef(null);

  // Camera parameters
  const cameraRadius = useRef(2000); // Base distance from origin
  const targetCameraRadius = useRef(2000); // Target distance for smooth transitions
  const screenShakeIntensity = useRef(0);

  // Cinematic Sequence States
  const cinematicState = useRef('none'); // Possible states: 'zoomOut', 'hold', 'explode', 'none'
  const cinematicTimer = useRef(0); // Timer to manage duration of each cinematic state

  // Zoom Effect States
  const zoomState = useRef('none'); // Possible states: 'zoomIn', 'zoomOut', 'none'
  const zoomTimer = useRef(0); // Timer for zoom effect
  const zoomDuration = 1.5; // Duration of zoom effect in seconds
  const zoomCooldown = useRef(3); // Cooldown period in seconds
  const lastZoomTime = useRef(-zoomCooldown.current); // Initialize to allow immediate zoom

  // Perlin Noise Offsets for Smooth Random Camera Movement
  const noiseOffsetTheta = useRef(Math.random() * 1000);
  const noiseOffsetPhi = useRef(Math.random() * 1000);

  // Moving Average for Peak Detection
  const movingAvg = useRef(0);
  const avgWindow = useRef(60); // Number of frames for moving average
  const history = useRef([]);

  // State variables for media player
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Recording state variables
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Handles full-screen toggle
  const handleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  // Handles export functionality
  const handleExport = () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current.stop();
    } else {
      // Start recording
      recordedChunksRef.current = [];

      const canvasStream = canvasRef.current.captureStream(60);
      const audioStream = audioElementRef.current.captureStream();

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      const options = { mimeType: 'video/webm; codecs=vp9' };
      const mediaRecorder = new MediaRecorder(combinedStream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = 'visualization.webm';
        a.click();
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
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
          analyser.fftSize = 2048; // Increased FFT size for better frequency resolution
          const source = audioContext.createMediaElementSource(audioElement);
          source.connect(analyser);
          analyser.connect(audioContext.destination);

          analyserRef.current = analyser;
          audioContextRef.current = audioContext;
          audioElementRef.current = audioElement;

          setDuration(audioElement.duration);

          if (spherePositions.current.length === 0) {
            for (let i = 0; i < 200; i++) { // Further increased number of particles for richer effect
              spherePositions.current.push({
                x: Math.random() * 5000 - 2500, // Expanded range for more space
                y: Math.random() * 5000 - 2500,
                z: Math.random() * 5000 - 2500,
                originalX: Math.random() * 5000 - 2500,
                originalY: Math.random() * 5000 - 2500,
                originalZ: Math.random() * 5000 - 2500,
                // Additional properties for dancing
                angle: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.01,
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
            if (isRecording && mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
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
    p5.pixelDensity(Math.min(2, p5.displayDensity())); // Increased pixel density for higher definition
    p5.noStroke();
    p5.smooth(); // Enable anti-aliasing for smoother visuals
    p5.colorMode(p5.HSB);

    // Enhanced Lighting
    p5.ambientLight(150, 150, 150);
    p5.directionalLight(255, 255, 255, 0.25, 0.25, -1);
    p5.pointLight(255, 255, 255, 0, 0, 500); // Additional point light for depth
    p5.pointLight(255, 204, 100, -500, 500, 500); // Secondary point light for richer lighting

    const cam = p5.createCamera();
    cam.setPosition(0, 0, cameraRadius.current);
    cam.lookAt(0, 0, 0);
    cameraRef.current = cam;

    canvasRef.current = p5.canvas;
  };

  // Handles drawing the visual elements on the canvas
  const draw = (p5) => {
    p5.clear();

    let lowAvg = 0;
    let midAvg = 0;
    let highAvg = 0;
    let totalAvg = 0;
    let hue = 0;

    let dataArray = [];
    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 2048;

    if (analyserRef.current) {
      const analyser = analyserRef.current;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      const lowFreq = dataArray.slice(0, bufferLength / 3);
      const midFreq = dataArray.slice(bufferLength / 3, (bufferLength / 3) * 2);
      const highFreq = dataArray.slice((bufferLength / 3) * 2);

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

    // Update Moving Average
    history.current.push(totalAvg);
    if (history.current.length > avgWindow.current) {
      history.current.shift();
    }
    const sum = history.current.reduce((a, b) => a + b, 0);
    movingAvg.current = sum / history.current.length;

    // Peak Detection
    const peakThreshold = 1.5; // Trigger zoom if totalAvg > 1.5 * movingAvg
    const currentTimeSec = audioElementRef.current ? audioElementRef.current.currentTime : 0;

    if (
      totalAvg > peakThreshold * movingAvg.current &&
      currentTimeSec > lastZoomTime.current + zoomCooldown.current &&
      zoomState.current === 'none'
    ) {
      // Randomly decide to zoom in or zoom out
      const zoomDirection = p5.random() > 0.5 ? 'zoomIn' : 'zoomOut';
      zoomState.current = zoomDirection;
      zoomTimer.current = 0;
      lastZoomTime.current = currentTimeSec;
      console.log(`Zoom Effect Triggered: ${zoomDirection} at ${currentTimeSec.toFixed(2)}s`);
    }

    // Handle Zoom Effects
    if (zoomState.current !== 'none') {
      zoomTimer.current += p5.deltaTime / 1000; // Convert to seconds

      const progress = p5.min(zoomTimer.current / zoomDuration, 1); // Clamp progress to [0,1]

      if (zoomState.current === 'zoomIn') {
        // Zoom In: Decrease camera radius
        targetCameraRadius.current = p5.lerp(2000, 800, progress);
      } else if (zoomState.current === 'zoomOut') {
        // Zoom Out: Increase camera radius
        targetCameraRadius.current = p5.lerp(2000, 3000, progress);
      }

      // Smoothly transition to targetCameraRadius
      cameraRadius.current = p5.lerp(cameraRadius.current, targetCameraRadius.current, 0.05);
      cameraRef.current.setPosition(0, 0, cameraRadius.current);
      cameraRef.current.lookAt(0, 0, 0);

      // Logging for debugging
      if (zoomState.current === 'zoomIn') {
        console.log(`Zooming In: Camera Radius ${cameraRadius.current.toFixed(2)}`);
      } else if (zoomState.current === 'zoomOut') {
        console.log(`Zooming Out: Camera Radius ${cameraRadius.current.toFixed(2)}`);
      }

      if (zoomTimer.current >= zoomDuration) {
        // Reset zoom state
        zoomState.current = 'none';
        zoomTimer.current = 0;
        targetCameraRadius.current = 2000; // Reset to base radius
        console.log(`Zoom Effect Completed: Reset to base radius`);
      }
    } else {
      // Regular Cinematic Sequence Management
      const deltaTime = p5.deltaTime / 1000; // Convert to seconds
      cinematicTimer.current += deltaTime;

      switch (cinematicState.current) {
        case 'none':
          // Trigger cinematic sequence based on certain condition
          // Example: When totalAvg exceeds a threshold and a cooldown has passed
          if (totalAvg > 180 && cinematicTimer.current > 5) { // Lowered threshold and cooldown for testing
            console.log("Cinematic Sequence Triggered: Zoom Out");
            cinematicState.current = 'zoomOut';
            cinematicTimer.current = 0;
          }
          break;

        case 'zoomOut':
          // Gradually zoom out over 3 seconds
          if (cinematicTimer.current < 3) {
            targetCameraRadius.current = p5.lerp(2000, 2500, cinematicTimer.current / 3);
            cameraRadius.current = p5.lerp(cameraRadius.current, targetCameraRadius.current, 0.05);
            cameraRef.current.setPosition(0, 0, cameraRadius.current);
            cameraRef.current.lookAt(0, 0, 0);
            console.log(`Cinematic Zoom Out: Camera Radius ${cameraRadius.current.toFixed(2)}`);
          } else {
            cinematicState.current = 'hold';
            cinematicTimer.current = 0;
          }
          break;

        case 'hold':
          // Hold the zoomed-out position for 2 seconds with tension
          if (cinematicTimer.current < 2) {
            // Introduce pulsating effect by slightly modifying camera position
            const pulsateAmplitude = 50; // Adjust as needed
            const pulsateFrequency = 2; // Pulses per second
            const pulsate = pulsateAmplitude * Math.sin(p5.TWO_PI * pulsateFrequency * cinematicTimer.current);
            cameraRef.current.setPosition(0, pulsate, cameraRadius.current);
            cameraRef.current.lookAt(0, 0, 0);

            // Optionally, increase ambient light for added tension
            p5.ambientLight(200, 200, 200);
          }

          if (cinematicTimer.current >= 2) {
            cinematicState.current = 'explode';
            cinematicTimer.current = 0;

            // Trigger explosion effect: e.g., increase screen shake intensity
            screenShakeIntensity.current = 150; // Increased intensity for a more dramatic explosion
            console.log("Cinematic Sequence: Explosion Triggered");
          }
          break;

        case 'explode':
          // Release the explosion over 2 seconds
          if (cinematicTimer.current < 2) {
            // Gradually reduce screen shake intensity
            screenShakeIntensity.current = p5.lerp(screenShakeIntensity.current, 0, 0.05);
            console.log(`Exploding: Screen Shake Intensity ${screenShakeIntensity.current.toFixed(2)}`);
          } else {
            cinematicState.current = 'none';
            cinematicTimer.current = 0;
            console.log("Cinematic Sequence Completed");
          }
          break;

        default:
          cinematicState.current = 'none';
          cinematicTimer.current = 0;
      }
    }

    // Apply screen shake if intensity is greater than zero
    if (screenShakeIntensity.current > 0) {
      const shakeX = p5.random(-screenShakeIntensity.current, screenShakeIntensity.current);
      const shakeY = p5.random(-screenShakeIntensity.current, screenShakeIntensity.current);
      const shakeZ = p5.random(-screenShakeIntensity.current, screenShakeIntensity.current);

      cameraRef.current.setPosition(
        cameraRef.current.eyeX + shakeX,
        cameraRef.current.eyeY + shakeY,
        cameraRef.current.eyeZ + shakeZ
      );
      cameraRef.current.lookAt(0, 0, 0);
    }

    // Responsive Camera Movements with Smooth Randomness via Perlin Noise
    if (zoomState.current === 'none' && cinematicState.current === 'none') { // Only apply dynamic camera movement if not zooming or in cinematic sequence
      const sensitivity = 0.001; // Further reduced sensitivity for slower movement

      // Update noise offsets
      const noiseIncrement = 0.005; // Speed of noise variation
      noiseOffsetTheta.current += noiseIncrement;
      noiseOffsetPhi.current += noiseIncrement;

      // Generate smooth random values using Perlin noise
      const noiseTheta = p5.noise(noiseOffsetTheta.current);
      const noisePhi = p5.noise(noiseOffsetPhi.current);

      // Map noise values to angles
      const theta = p5.map(noiseTheta, 0, 1, 0, Math.PI * 2); // Azimuthal angle
      const phi = p5.map(noisePhi, 0, 1, 0.2, Math.PI - 0.2); // Polar angle (avoid poles for better visuals)

      // Calculate camera position using spherical coordinates
      const camX = cameraRadius.current * p5.sin(phi) * p5.cos(theta);
      const camY = cameraRadius.current * p5.sin(phi) * p5.sin(theta);
      const camZ = cameraRadius.current * p5.cos(phi);

      // Apply screen shake based on current screenShakeIntensity
      cameraRef.current.setPosition(camX, camY, camZ);
      cameraRef.current.lookAt(0, 0, 0);
    }

    const bassVibration = p5.map(lowAvg, 0, 255, 0.2, 1);

    // Draw central bass sphere with higher resolution
    p5.push();
    p5.fill(hue, 100, 100, 0.8);
    const bassSize = p5.map(lowAvg, 0, 255, 50, 300); // Increased size for more impact
    p5.scale(1 + p5.sin(p5.frameCount * bassVibration) * 0.05); // Increased scale factor for more dynamic effect
    p5.sphere(bassSize || 50, 64, 64); // Increased detail with more segments
    p5.pop();

    if (lowAvg > 1) {
      p5.pointLight(255, 255, 255, 0, 0, 500);
      p5.ambientLight(255);
    } else {
      p5.ambientLight(150);
    }

    // Update and make particles dance
    spherePositions.current.forEach((sphere) => {
      // Update angle for each particle to create dancing motion
      sphere.angle += sphere.speed;

      // Calculate displacement based on sine and cosine of the angle
      const displacement = 60; // Increased displacement for more dramatic dance
      const deltaX = Math.sin(sphere.angle) * displacement;
      const deltaY = Math.cos(sphere.angle) * displacement;

      // Apply displacement based on audio data
      sphere.x = p5.lerp(sphere.x, sphere.originalX + deltaX * (totalAvg / 255), 0.03); // Faster lerp for more responsiveness
      sphere.y = p5.lerp(sphere.y, sphere.originalY + deltaY * (totalAvg / 255), 0.03);
      sphere.z = p5.lerp(sphere.z, sphere.originalZ + deltaX * (totalAvg / 255), 0.03); // Using deltaX for Z as well for depth
    });

    p5.push();
    spherePositions.current.forEach((sphere) => {
      p5.push();
      p5.translate(sphere.x, sphere.y, sphere.z);
      // Make particle colors respond to high frequencies for a "dancing" effect
      const particleHue = (hue + highAvg) % 360;
      p5.fill(particleHue, 100, 100, 0.7);
      p5.sphere(8, 32, 32); // Increased size and detail for better visibility
      p5.pop();
    });
    p5.pop();

    // Rotating grid with responsive waves
    p5.push();
    p5.rotateX(p5.frameCount * 0.005);
    p5.rotateY(p5.frameCount * 0.005);
    const gridSize = 50; // Increased grid size for more space
    for (let x = -p5.width / 2; x < p5.width / 2; x += gridSize) {
      for (let y = -p5.height / 2; y < p5.height / 2; y += gridSize) {
        const d = p5.dist(x, y, 0, 0);
        const offset = p5.map(d, 0, p5.width / 2, -p5.PI, p5.PI);

        // Use both midAvg and highAvg for more dynamic waves
        const wave = p5.sin(p5.frameCount * 0.02 + offset) * p5.map(midAvg + highAvg, 0, 1020, 0, 300);

        p5.push();
        p5.translate(x, y, wave || 0);

        const sphereSize = p5.map(highAvg, 0, 255, 10, 40) || 10; // Increased maximum size

        const sphereHue = (hue + offset * 50) % 360;
        const sphereSaturation = p5.map(lowAvg, 0, 255, 50, 100) || 50;
        const sphereBrightness = p5.map(highAvg, 0, 255, 50, 100) || 50;

        p5.fill(sphereHue, sphereSaturation, sphereBrightness);
        p5.sphere(sphereSize, 24, 24); // Increased detail for better appearance
        p5.pop();
      }
    }
    p5.pop();

    // Visualizer Bar Graph with higher detail
    p5.push();
    const radius = p5.height / 2; // Increased radius for better visibility
    const angleStep = (Math.PI * 2) / 256; // Increased number of bars for smoother graph

    for (let i = 0; i < 256; i++) { // Further increased number of bars
      const dataIdx = i * 2;
      const amplitude = dataArray[dataIdx] || 0;
      const mappedAmplitude = p5.map(amplitude, 0, 255, 0, radius);
      const angle = angleStep * i;

      const z = -1500; // Adjusted z-position for better depth

      p5.push();
      p5.translate(0, 0, z);
      p5.rotateZ(angle);
      p5.fill((hue + i * 1.5) % 360, 80, 100);
      p5.rectMode(p5.CORNER);
      p5.noStroke();
      p5.rect(radius, -15, mappedAmplitude, 30); // Increased bar height for better visibility
      p5.pop();
    }
    p5.pop();
  };

  // Handle window resize for responsive design
  const windowResized = (p5) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <div>
      <button onClick={onBack} className="back-button">
        Back
      </button>
      <button onClick={handleFullscreen} className="fullscreen-button">
        Toggle Fullscreen
      </button>
      <button onClick={handleExport} className="export-button">
        {isRecording ? 'Stop Export' : 'Export as MP4'}
      </button>
      <Sketch setup={setup} draw={draw} windowResized={windowResized} />

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
