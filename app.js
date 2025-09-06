// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// DOM elements
const uploadImage = document.getElementById('uploadImage');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');
const instructionsInput = document.getElementById('instructionsInput');
const addInstructionsBtn = document.getElementById('addInstructionsBtn');
const undoBtn = document.getElementById('undoBtn');
const markerList = document.getElementById('markerList');
const modeButtons = document.querySelectorAll('.btn[data-mode]');

// State
let image = new Image();
let currentMode = 'screw';
let counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
let markers = [];
let drawing = false;
let currentPath = [];

// ---------------------------
// Helper Functions
// ---------------------------

// Draw welcome text. This should be migrated to the HTML and CSS later, but I am busy with other stuff and it is working X-P
function drawWelcomeText() {
  if (!image.src) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = [
      { text: '🪛 Welcome to Jonny Box! 🪛', font: '56px Arial' }, // first line bigger with emoji
      { text: 'The ultimate technician\'s assistant.', font: '46px Arial' },
      { text: 'Choose an image or upload a project to begin.', font: '32px Arial' },
      { text: '© Jonathan Welch', font: '32px Arial' }
    ];

    const lineHeight = 70; // spacing between lines
    const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
      ctx.font = line.font;           // set font per line
      ctx.fillText(line.text, canvas.width / 2, startY + index * lineHeight);
    });
  }
}

// Reset canvas
function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  } else {
    drawWelcomeText();
  }
}

// Get color for marker type
function colorForType(type) {
  switch (type) {
    case 'screw': return '#28a745';
    case 'bolt': return '#dc3545';
    case 'component': return '#007bff';
    case 'custom': return '#ffc107';
    default: return '#000';
  }
}

// Redraw all markers
function redrawMarkers() {
  resetCanvas();
  markers.forEach(marker => {
    if (marker.type === 'screw' || marker.type === 'bolt') {
      ctx.fillStyle = colorForType(marker.type);
      ctx.beginPath();
      const pt = marker.points[0];
      ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.number, pt.x, pt.y);
    } else {
      ctx.strokeStyle = colorForType(marker.type);
      ctx.lineWidth = 3;
      ctx.beginPath();
      marker.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      const firstPt = marker.points[0];
      ctx.fillStyle = colorForType(marker.type);
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(marker.number, firstPt.x + 5, firstPt.y + 5);
    }
  });
}

// Rebuild marker list in sidebar
function rebuildMarkerList() {
  markerList.innerHTML = '';
  markers.forEach(marker => {
    const li = document.createElement('li');
    li.textContent = `#${marker.number} (${marker.type})` + (marker.instructions ? `: ${marker.instructions}` : '');
    markerList.appendChild(li);
  });
}

// Add a marker
function addMarker(type, points) {
  const number = counters[type]++;
  markers.push({ type, number, points, instructions: '' });
  rebuildMarkerList();
  redrawMarkers();
}

// Resize canvas to fit image while keeping aspect ratio
function resizeCanvasToImage() {
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;

  let w = image.width;
  let h = image.height;

  const widthRatio = maxWidth / w;
  const heightRatio = maxHeight / h;
  const scale = Math.min(1, widthRatio, heightRatio);

  canvas.width = w * scale;
  canvas.height = h * scale;

  redrawMarkers();
}

// ---------------------------
// Event Helpers
// ---------------------------

// Get mouse position accounting for canvas scaling
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// Get touch position accounting for canvas scaling
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const t = e.touches[0] || e.changedTouches[0];
  return {
    x: (t.clientX - rect.left) * scaleX,
    y: (t.clientY - rect.top) * scaleY
  };
}

// ---------------------------
// Event Listeners
// ---------------------------

// Image upload
uploadImage.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    image = new Image();
    image.onload = () => resizeCanvasToImage();
    image.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

// Mode buttons
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.dataset.mode;
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Canvas mouse events
canvas.addEventListener('mousedown', e => {
  const { x, y } = getMousePos(e);
  if (!image.src) return;
  drawing = true;
  currentPath = [];
  if (currentMode === 'screw' || currentMode === 'bolt') {
    addMarker(currentMode, [{ x, y }]);
    drawing = false;
  } else {
    currentPath.push({ x, y });
  }
});

canvas.addEventListener('mousemove', e => {
  if (!drawing || !image.src) return;
  if (currentMode === 'component' || currentMode === 'custom') {
    const { x, y } = getMousePos(e);
    currentPath.push({ x, y });
    redrawMarkers();
    ctx.strokeStyle = colorForType(currentMode);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
});

canvas.addEventListener('mouseup', e => {
  if (!drawing) return;
  drawing = false;
  if (currentMode === 'component' || currentMode === 'custom') {
    if (currentPath.length > 0) addMarker(currentMode, currentPath);
    currentPath = [];
  }
});

// Touch events
canvas.addEventListener('touchstart', e => {
  if (!image.src) return;
  e.preventDefault();
  drawing = true;
  currentPath = [];
  const { x, y } = getTouchPos(e);
  if (currentMode === 'screw' || currentMode === 'bolt') {
    addMarker(currentMode, [{ x, y }]);
    drawing = false;
  } else {
    currentPath.push({ x, y });
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = getTouchPos(e);
  currentPath.push({ x, y });
  redrawMarkers();
  if (currentMode === 'component' || currentMode === 'custom') {
    ctx.strokeStyle = colorForType(currentMode);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!drawing) return;
  drawing = false;
  if (currentMode === 'component' || currentMode === 'custom') {
    if (currentPath.length > 0) addMarker(currentMode, currentPath);
    currentPath = [];
  }
}, { passive: false });

// Instructions
addInstructionsBtn.addEventListener('click', () => {
  if (markers.length === 0) { alert('No markers yet!'); return; }
  const text = instructionsInput.value.trim();
  if (!text) { alert('Enter instructions first!'); return; }
  markers[markers.length - 1].instructions = text;
  rebuildMarkerList();
  instructionsInput.value = '';
});

// Undo
undoBtn.addEventListener('click', () => {
  if (markers.length === 0) { alert('No steps to undo!'); return; }
  const removed = markers.pop();
  if (counters[removed.type] > 1) counters[removed.type]--;
  rebuildMarkerList();
  redrawMarkers();
});

// Export
exportBtn.addEventListener('click', () => {
  if (!image.src) { alert('Load an image first!'); return; }
  const data = { imageSrc: image.src, canvasWidth: canvas.width, canvasHeight: canvas.height, counters, markers };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  let filename = prompt('Enter filename:', 'jonnybox_project.json');
  if (!filename) filename = 'jonnybox_project.json';
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

// Import
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.imageSrc || !data.markers) { alert('Invalid project file!'); return; }
      image = new Image();
      image.onload = () => {
        canvas.width = data.canvasWidth || image.width;
        canvas.height = data.canvasHeight || image.height;
        counters = data.counters || { screw: 1, bolt: 1, component: 1, custom: 1 };
        markers = data.markers || [];
        redrawMarkers();
        rebuildMarkerList();
      };
      image.src = data.imageSrc;
    } catch (err) {
      alert('Error loading project: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// Default: screw mode active
document.querySelector('.btn[data-mode="screw"]').classList.add('active');

// Draw welcome text initially
drawWelcomeText();
