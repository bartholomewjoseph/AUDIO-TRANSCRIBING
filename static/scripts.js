let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Web Audio API objects for the visualizer
let audioContext;
let analyser;
let visualizerAnimationId;

// Grab UI elements
const recordBtn = document.getElementById('recordBtn');
const btnText = document.getElementById('btnText');
const btnIcon = document.getElementById('btnIcon');
const transcriptionOutput = document.getElementById('transcriptionOutput');
const translationOutput = document.getElementById('translationOutput');
const visualizerCanvas = document.getElementById('visualizer');
const canvasCtx = visualizerCanvas.getContext('2d');

const audioFileInput = document.getElementById('audioFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// ---------------------------
// RECORDING
// ---------------------------
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                sendAudioToServer(new Blob(audioChunks, { type: 'audio/webm' }), 'recording.webm');
            };

            mediaRecorder.start();
            isRecording = true;

            recordBtn.classList.replace('bg-red-500', 'bg-gray-500');
            recordBtn.classList.replace('hover:bg-red-600', 'hover:bg-gray-600');
            btnIcon.textContent = "⏹️";
            btnText.textContent = "Stop Recording";
            transcriptionOutput.value = "Listening...";
            translationOutput.value = "";

            startVisualizer(stream);

        } catch (err) {
            alert("Microphone access denied. Please allow microphone permissions.");
            console.error(err);
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;

        recordBtn.classList.replace('bg-gray-500', 'bg-red-500');
        recordBtn.classList.replace('hover:bg-gray-600', 'hover:bg-red-600');
        btnIcon.textContent = "🎤";
        btnText.textContent = "Start Recording";
        transcriptionOutput.value = "Processing audio with AI... please wait.";

        stopVisualizer();
    }
});

// ---------------------------
// LIVE AUDIO VISUALIZER
// ---------------------------
function startVisualizer(stream) {
    visualizerCanvas.classList.remove('hidden');

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#111827'; // dark background
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;

            // Red-ish bars to match the recording theme
            canvasCtx.fillStyle = `rgb(${220}, ${60 + barHeight}, ${60})`;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    draw();
}

function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
    }
    if (audioContext) {
        audioContext.close();
    }
    // Clear and hide the canvas
    canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    visualizerCanvas.classList.add('hidden');
}

// ---------------------------
// FILE UPLOAD
// ---------------------------
audioFileInput.addEventListener('change', () => {
    if (audioFileInput.files.length > 0) {
        fileNameDisplay.textContent = `Selected: ${audioFileInput.files[0].name}`;
    } else {
        fileNameDisplay.textContent = '';
    }
});

uploadBtn.addEventListener('click', () => {
    if (audioFileInput.files.length === 0) {
        alert("Please choose an audio file first.");
        return;
    }

    const file = audioFileInput.files[0];
    transcriptionOutput.value = "Processing audio with AI... please wait.";
    translationOutput.value = "";

    sendAudioToServer(file, file.name);
});

// ---------------------------
// SHARED: SEND TO SERVER
// ---------------------------
async function sendAudioToServer(audioBlob, filename) {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    formData.append('sourceLang', document.getElementById('sourceLang').value);
    formData.append('targetLang', document.getElementById('targetLang').value);

    try {
        const response = await fetch('/translate', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error("Server failed to process audio");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        transcriptionOutput.value = data.transcription;
        translationOutput.value = data.translation;

    } catch (error) {
        console.error(error);
        transcriptionOutput.value = "Error processing transcription.";
        translationOutput.value = "Error processing translation.";
    }
}