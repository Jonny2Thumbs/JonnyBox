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

const modeButtons = document.querySelectorAll('.btn[data-mode]');
const container = document.querySelector('body');  // container for rotate warning display control
const rotateWarning = document.getElementById('rotateWarning');

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

function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
}

// Draw all markers on canvas
function redrawMarkers() {
  resetCanvas();

  markers.forEach(marker => {
    if (marker.type === 'screw' || marker.type === 'bolt') {
      // draw circle with color and number
      ctx.fillStyle = colorForType(marker.type);
      ctx.beginPath();
      const pt = marker.points[0];
      ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      ctx.fill();
      // number
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.number, pt.x, pt.y);
    } else if (marker.type === 'component' || marker.type === 'custom') {
      // draw freehand path
      ctx.strokeStyle = colorForType(marker.type);
      ctx.lineWidth = 3;
      ctx.beginPath();
      marker.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      // number near first point
      ctx.fillStyle = colorForType(marker.type);
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const firstPt = marker.points[0];
      ctx.fillText(marker.number, firstPt.x + 5, firstPt.y + 5);
    }
  });
}

// Return color based on type
function colorForType(type) {
  switch(type) {
    case 'screw': return '#28a745';    // green
    case 'bolt': return '#dc3545';     // red
    case 'component': return '#007bff';// blue
    case 'custom': return '#ffc107';   // goldenrod
    default: return '#000000';
  }
}

// Rebuild the steps list UI
function rebuildMarkerList() {
  markerList.innerHTML = '';
  markers.forEach(marker => {
    const li = document.createElement('li');
    li.textContent = `#${marker.number} (${marker.type})` + (marker.instructions ? `: ${marker.instructions}` : '');
    markerList.appendChild(li);
  });
}

// Add new marker (point or freehand)
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

// Resize canvas to image size with max width/height constraints,
// swapping width/height when rotated (portrait small screens)
function resizeCanvasToImage() {
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const isSmallScreen = window.matchMedia("(max-width: 767px)").matches;

  let maxWidth = window.innerWidth - 280; // leave space for sidebar
  let maxHeight = window.innerHeight - 40;

  // Swap max width and height if rotated (portrait small screens)
  if (isPortrait && isSmallScreen) {
    [maxWidth, maxHeight] = [maxHeight, maxWidth];
  }

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

  // Swap canvas dimensions for rotated mode
  if (isPortrait && isSmallScreen) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }
  redrawMarkers();
}

// Get pointer position with rotation adjustment
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

  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const isSmallScreen = window.matchMedia("(max-width: 767px)").matches;

  if (isPortrait && isSmallScreen) {
    // Adjust coordinates for 90deg rotation clockwise of container
    let rotatedX = clientY - rect.top;
    let rotatedY = canvas.width - (clientX - rect.left);

    rotatedX = Math.max(0, Math.min(rotatedX, canvas.width));
    rotatedY = Math.max(0, Math.min(rotatedY, canvas.height));

    return { x: rotatedX, y: rotatedY };
  } else {
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
}

// Event: Load image from file input
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

// Event: Select mode button
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.getAttribute('data-mode');
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Drawing handlers
canvas.addEventListener('mousedown', (e) => {
  if (!image.src) return;

  drawing = true;
  currentPath = [];

  const pos = getPointerPos(e);
  const x = pos.x;
  const y = pos.y;

  if (currentMode === 'screw' || currentMode === 'bolt') {
    addMarker(currentMode, [{ x, y }]);
    drawing = false;
  } else {
    currentPath.push({ x, y });
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  if (!image.src) return;

  if (currentMode === 'component' || currentMode === 'custom') {
    const pos = getPointerPos(e);
    currentPath.push({ x: pos.x, y: pos.y });
    redrawMarkers();

    // Draw current path in-progress
    ctx.strokeStyle = colorForType(currentMode);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;

  if (currentMode === 'component' || currentMode === 'custom') {
    if (currentPath.length > 2) {
      addMarker(currentMode, currentPath);
    }
    currentPath = [];
  }
});

// Touch support for drawing
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!image.src) return;

  drawing = true;
  currentPath = [];

  const pos = getPointerPos(e);
  const x = pos.x;
  const y = pos.y;

  if (currentMode === 'screw' || currentMode === 'bolt') {
    addMarker(currentMode, [{ x, y }]);
    drawing = false;
  } else {
    currentPath.push({ x, y });
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!drawing) return;
  if (!image.src) return;

  if (currentMode === 'component' || currentMode === 'custom') {
    const pos = getPointerPos(e);
    currentPath.push({ x: pos.x, y: pos.y });
    redrawMarkers();

    // Draw current path in-progress
    ctx.strokeStyle = colorForType(currentMode);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!drawing) return;
  drawing = false;

  if (currentMode === 'component' || currentMode === 'custom') {
    if (currentPath.length > 2) {
      addMarker(currentMode, currentPath);
    }
    currentPath = [];
  }
});

// Add instructions to last marker
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

// Export markers and image info as JSON
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

// Import markers and image info from JSON
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

// Initialize: select screw mode by default
document.querySelector('.btn[data-mode="screw"]').classList.add('active');

// Check orientation and show/hide warning and container
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

window.addEventListener('resize', checkOrientationAndWarn);
window.addEventListener('orientationchange', checkOrientationAndWarn);

// Initial check
checkOrientationAndWarn();

image.onload = function () {
  resizeCanvasToImage();
  redrawMarkers();
};
