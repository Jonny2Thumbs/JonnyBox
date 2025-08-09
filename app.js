// Get DOM elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const uploadImage = document.getElementById('uploadImage');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');

const instructionsInput = document.getElementById('instructionsInput');
const addInstructionsBtn = document.getElementById('addInstructionsBtn');

const markerList = document.getElementById('markerList');
const sidebar = document.querySelector('.sidebar');
const container = document.querySelector('.container');
const rotateWarning = document.querySelector('.rotate-warning');

const modeButtons = document.querySelectorAll('.btn[data-mode]');

let image = new Image();
let currentMode = 'screw';

// Independent numbering for each type
let counters = {
  screw: 1,
  bolt: 1,
  component: 1,
  custom: 1
};

// Store markers: each marker has { type, number, points, instructions }
// points: array of {x,y} for freehand path; for screws/bolts it will be single point
let markers = [];

let drawing = false;
let currentPath = [];

// Helpers for pointer position (mouse or touch)
function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if (evt.touches && evt.touches.length) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX;
    clientY = evt.clientY;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
}

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
    } else if (marker.type === 'component' || marker.type === 'custom') {
      ctx.strokeStyle = colorForType(marker.type);
      ctx.lineWidth = 3;
      ctx.beginPath();
      marker.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = colorForType(marker.type);
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const firstPt = marker.points[0];
      ctx.fillText(marker.number, firstPt.x + 5, firstPt.y + 5);
    }
  });
}

function colorForType(type) {
  switch(type) {
    case 'screw': return '#28a745';
    case 'bolt': return '#dc3545';
    case 'component': return '#007bff';
    case 'custom': return '#ffc107';
    default: return '#000000';
  }
}

function rebuildMarkerList() {
  markerList.innerHTML = '';
  markers.forEach(marker => {
    const li = document.createElement('li');
    li.textContent = `#${marker.number} (${marker.type})` + (marker.instructions ? `: ${marker.instructions}` : '');
    markerList.appendChild(li);
  });
}

function addMarker(type, points) {
  const number = counters[type]++;
  const marker = {
    type,
    number,
    points,
    instructions: ''
  };
  markers.push(marker);
  rebuildMarkerList();
  redrawMarkers();
}

function resizeCanvasToImage() {
  const maxWidth = window.innerWidth - 280; // leave space for sidebar + padding
  const maxHeight = window.innerHeight - 40;

  let w = image.width;
  let h = image.height;

  if (w > maxWidth) {
    h = h * (maxWidth / w);
    w = maxWidth;
  }
  if (h > maxHeight) {
    w = w * (maxHeight / h);
    h = maxHeight;
  }

  canvas.width = w;
  canvas.height = h;
  redrawMarkers();
}

function checkOrientationAndWarn() {
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const isSmallScreen = window.matchMedia("(max-width: 767px)").matches;

  if (isPortrait && isSmallScreen) {
    rotateWarning.classList.add('visible');
    container.style.display = 'none';
  } else {
    rotateWarning.classList.remove('visible');
    container.style.display = 'flex';
    if (image.src) {
      resizeCanvasToImage();
    }
  }
}

// Event Listeners

uploadImage.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    image = new Image();
    image.onload = function() {
      resizeCanvasToImage();
      redrawMarkers();
    };
    image.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.getAttribute('data-mode');
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Drawing (mouse + touch)

function pointerDownHandler(e) {
  if (!image.src) return;

  e.preventDefault();
  drawing = true;
  currentPath = [];

  const pos = getPointerPos(e);
  if (currentMode === 'screw' || currentMode === 'bolt') {
    addMarker(currentMode, [{ x: pos.x, y: pos.y }]);
    drawing = false;
  } else {
    currentPath.push({ x: pos.x, y: pos.y });
  }
}
function pointerMoveHandler(e) {
  if (!drawing) return;
  if (!image.src) return;

  e.preventDefault();
  if (currentMode === 'component' || currentMode === 'custom') {
    const pos = getPointerPos(e);
    currentPath.push({ x: pos.x, y: pos.y });
    redrawMarkers();

    ctx.strokeStyle = colorForType(currentMode);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
}
function pointerUpHandler(e) {
  if (!drawing) return;
  drawing = false;

  if (currentMode === 'component' || currentMode === 'custom') {
    if (currentPath.length > 2) {
      addMarker(currentMode, currentPath);
    }
    currentPath = [];
  }
}

canvas.addEventListener('mousedown', pointerDownHandler);
canvas.addEventListener('mousemove', pointerMoveHandler);
canvas.addEventListener('mouseup', pointerUpHandler);
canvas.addEventListener('mouseout', pointerUpHandler);

// Touch support
canvas.addEventListener('touchstart', pointerDownHandler, { passive: false });
canvas.addEventListener('touchmove', pointerMoveHandler, { passive: false });
canvas.addEventListener('touchend', pointerUpHandler);
canvas.addEventListener('touchcancel', pointerUpHandler);

addInstructionsBtn.addEventListener('click', () => {
  if (markers.length === 0) {
    alert('No markers yet to add instructions!');
    return;
  }
  const lastMarker = markers[markers.length - 1];
  const text = instructionsInput.value.trim();
  if (text === '') {
    alert('Please enter some instructions before adding.');
    return;
  }
  lastMarker.instructions = text;
  rebuildMarkerList();
  alert(`Instructions added to step #${lastMarker.number} (${lastMarker.type})`);
  instructionsInput.value = '';
});

const undoBtn = document.getElementById('undoBtn');

undoBtn.addEventListener('click', () => {
  if (markers.length === 0) {
    alert('No steps to undo!');
    return;
  }

  const removed = markers.pop();
  if (counters[removed.type] > 1) {
    counters[removed.type]--;
  }

  rebuildMarkerList();
  redrawMarkers();
});

exportBtn.addEventListener('click', () => {
  if (!image.src) {
    alert('Please load an image first.');
    return;
  }
  const exportData = {
    imageSrc: image.src,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    counters,
    markers
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  let filename = prompt('Enter filename to save your project:', 'jonnybox_project.json');
  if (!filename) filename = 'jonnybox_project.json';

  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.imageSrc || !data.markers) {
        alert('Invalid project file!');
        return;
      }
      image = new Image();
      image.onload = function() {
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

// Select screw mode by default on load
document.querySelector('.btn[data-mode="screw"]').classList.add('active');

window.addEventListener('resize', checkOrientationAndWarn);
window.addEventListener('orientationchange', checkOrientationAndWarn);

image.onload = function () {
  resizeCanvasToImage();
  redrawMarkers();
};

checkOrientationAndWarn();
