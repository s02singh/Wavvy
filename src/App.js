// App.jsx
import React, { useState } from 'react';
import './App.css';
import Visualizer from './Visualizer';

function App() {
  // State to store the uploaded audio file
  const [audioFile, setAudioFile] = useState(null);
  
  // State to store the file name
  const [audioFileName, setAudioFileName] = useState('');

  // State to track whether the song is loaded for visualization
  const [isSongLoaded, setIsSongLoaded] = useState(false);

  // Handles audio file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(URL.createObjectURL(file));
      setAudioFileName(file.name);
      setIsSongLoaded(false);
    }
  };

  // Starts visualization when the user clicks "Visualize"
  const handleVisualize = () => {
    setIsSongLoaded(true);
  };

  return (
    <div className="App">
      {!isSongLoaded ? (
        <div className="welcome-container">
          <h1 className="app-name">Wavvy</h1>
          <h2 className="tagline">Visualize your Music</h2>
          <div className="input-options">
            <input 
              type="file" 
              accept="audio/*" 
              className="file-input" 
              onChange={handleFileUpload} 
            />
          </div>
          {audioFileName && (
            <button className="load-button" onClick={handleVisualize}>
              Visualize
            </button>
          )}
        </div>
      ) : (
        <Visualizer
          audioFile={audioFile}
          onBack={() => setIsSongLoaded(false)}
          songTitle={audioFileName}
        />
      )}

      {/* Signature */}
      <div className="signature">
        Powered by <span className="coast-signature">Coast</span>
      </div>
    </div>
  );
}

export default App;
