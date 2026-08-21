// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// DOM elements
const uploadImage = document.getElementById('uploadImage');
const addPhotoInput = document.getElementById('addPhotoInput');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');
const instructionsInput = document.getElementById('instructionsInput');
const addInstructionsBtn = document.getElementById('addInstructionsBtn');
const undoBtn = document.getElementById('undoBtn');
const markerList = document.getElementById('markerList');
const modeButtons = document.querySelectorAll('.btn[data-mode]');
const photoTabs = document.getElementById('photoTabs');
const emptyState = document.getElementById('emptyState');
const repeatBtn = document.getElementById('repeatBtn');
const repeatDropdown = document.getElementById('repeatDropdown');
const repeatStatus = document.getElementById('repeatStatus');

// =============================================
// Instructions popup
// =============================================
const instructionsBtn = document.getElementById('instructionsBtn');
const instructionsModal = document.getElementById('instructionsModal');
const instructionsCloseBtn = document.getElementById('instructionsCloseBtn');

if (instructionsBtn && instructionsModal && instructionsCloseBtn) {
  instructionsBtn.addEventListener('click', () => {
    instructionsModal.hidden = false;
  });

  instructionsCloseBtn.addEventListener('click', () => {
    instructionsModal.hidden = true;
  });

  instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) {
      instructionsModal.hidden = true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !instructionsModal.hidden) {
      instructionsModal.hidden = true;
    }
  });
} else {
  console.warn('Instructions popup elements not found in the DOM — skipping popup setup.');
}

// ---------------------------
// State
// ---------------------------

// Each photo: { name, image, canvasWidth, canvasHeight, markers }
let photos = [];
let currentPhotoIndex = -1;

let currentMode = 'screw';

// Counters are GLOBAL and shared across all photos in the project —
// numbering continues across photos rather than resetting per photo.
let counters = { screw: 1, bolt: 1, component: 1, custom: 1 };

let drawing = false;
let currentPath = [];

// Repeat-marker mode: place an existing marker number again without
// advancing the sequence.
let repeatMode = false;
let repeatSelection = null; // { type, number }

// Global action history, in the order markers were added, across all
// photos. Used so Undo always removes the true last marker placed, and
// so the Steps list can show a single numbered sequence.
// Each entry: { photoIndex, marker }
let actionHistory = [];

// ---------------------------
// Helper Functions
// ---------------------------

function getCurrentPhoto() {
  return currentPhotoIndex >= 0 ? photos[currentPhotoIndex] : null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function activeDrawType() {
  return (repeatMode && repeatSelection) ? repeatSelection.type : currentMode;
}
function activeRepeatNumber() {
  return (repeatMode && repeatSelection) ? repeatSelection.number : null;
}

function colorForType(type) {
  switch (type) {
    case 'screw': return '#28a745';
    case 'bolt': return '#dc3545';
    case 'component': return '#007bff';
    case 'custom': return '#ffc107';
    default: return '#000';
  }
}

// Reset canvas to the current photo's image
function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const photo = getCurrentPhoto();
  if (photo) {
    ctx.drawImage(photo.image, 0, 0, canvas.width, canvas.height);
  }
}

// Redraw all markers for the CURRENT photo
function redrawMarkers() {
  resetCanvas();
  const photo = getCurrentPhoto();
  if (!photo) return;

  photo.markers.forEach(marker => {
    const label = marker.number + (marker.isRepeat ? 'R' : '');
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
      ctx.fillText(label, pt.x, pt.y);
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
      ctx.fillText(label, firstPt.x + 5, firstPt.y + 5);
    }
  });
}

// Rebuild the Steps list — a single numbered sequence across ALL photos,
// in the order things were actually done. Repeat markers are excluded
// here (they're just "this part also shows up here" pointers on the
// image, not separate disassembly steps) — but the marker's own
// type+number (e.g. "Screw #6") still shows, since that's what maps to
// the binder pocket / tackle box compartment / tag.
function rebuildMarkerList() {
  markerList.innerHTML = '';
  let stepNumber = 0;
  actionHistory.forEach(action => {
    const marker = action.marker;
    if (marker.isRepeat) return;
    stepNumber++;
    const photo = photos[action.photoIndex];
    const li = document.createElement('li');
    li.textContent = `Step ${stepNumber}: ${photo.name} — #${marker.number} (${marker.type})`
      + (marker.instructions ? `: ${marker.instructions}` : '');
    markerList.appendChild(li);
  });
}

// Rebuild the photo tab bar; hidden entirely for single-photo projects
function rebuildPhotoTabs() {
  photoTabs.innerHTML = '';
  if (photos.length <= 1) {
    photoTabs.hidden = true;
    return;
  }
  photoTabs.hidden = false;
  photos.forEach((photo, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'photo-tab' + (idx === currentPhotoIndex ? ' active' : '');
    tab.textContent = photo.name;
    tab.addEventListener('click', () => switchPhoto(idx));
    photoTabs.appendChild(tab);
  });
}

// Switch the visible/active photo
function switchPhoto(idx) {
  if (idx < 0 || idx >= photos.length) return;
  currentPhotoIndex = idx;
  const photo = photos[idx];
  canvas.width = photo.canvasWidth;
  canvas.height = photo.canvasHeight;
  canvas.hidden = false;
  emptyState.hidden = true;
  redrawMarkers();
  rebuildMarkerList();
  rebuildPhotoTabs();
}

// Compute a photo's canvas size from its image, keeping aspect ratio
function sizePhotoToImage(photo) {
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;

  const w = photo.image.width;
  const h = photo.image.height;

  const widthRatio = maxWidth / w;
  const heightRatio = maxHeight / h;
  const scale = Math.min(1, widthRatio, heightRatio);

  photo.canvasWidth = w * scale;
  photo.canvasHeight = h * scale;
}

function clearAllPhotos() {
  photos = [];
  currentPhotoIndex = -1;
  actionHistory = [];
  canvas.hidden = true;
  emptyState.hidden = false;
}

// Load a file into a new photo. If replace=true, clears the whole project first.
function loadPhotoFromFile(file, { replace = false } = {}) {
  const reader = new FileReader();
  reader.onload = evt => {
    const img = new Image();
    img.onload = () => {
      if (replace) clearAllPhotos();
      const photo = {
        name: `Photo ${photos.length + 1}`,
        image: img,
        canvasWidth: 0,
        canvasHeight: 0,
        markers: []
      };
      sizePhotoToImage(photo);
      photos.push(photo);
      switchPhoto(photos.length - 1);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Add a marker to the CURRENT photo.
// Pass repeatNumber to duplicate an existing number instead of advancing the counter.
function addMarker(type, points, repeatNumber = null) {
  const photo = getCurrentPhoto();
  if (!photo) return;

  const isRepeat = repeatNumber !== null;
  const number = isRepeat ? repeatNumber : counters[type]++;

  const marker = { type, number, points, instructions: '', isRepeat };
  photo.markers.push(marker);
  actionHistory.push({ photoIndex: currentPhotoIndex, marker });

  rebuildMarkerList();
  redrawMarkers();
}

// ---------------------------
// Repeat Marker dropdown
// ---------------------------

function collectAllMarkers() {
  const seen = new Map();
  photos.forEach(photo => {
    photo.markers.forEach(m => {
      const key = `${m.type}-${m.number}`;
      if (!seen.has(key)) seen.set(key, { type: m.type, number: m.number });
    });
  });
  return Array.from(seen.values()).sort((a, b) =>
    a.type.localeCompare(b.type) || a.number - b.number
  );
}

function rebuildRepeatDropdown() {
  const all = collectAllMarkers();
  repeatDropdown.innerHTML = '<option value="">-- Select a marker to repeat --</option>';
  all.forEach(m => {
    const opt = document.createElement('option');
    opt.value = `${m.type}-${m.number}`;
    opt.textContent = `${capitalize(m.type)} #${m.number}`;
    repeatDropdown.appendChild(opt);
  });
}

function cancelRepeatMode() {
  repeatMode = false;
  repeatSelection = null;
  if (repeatDropdown) repeatDropdown.hidden = true;
  if (repeatBtn) repeatBtn.classList.remove('active');
  if (repeatStatus) repeatStatus.textContent = '';
}

if (repeatBtn && repeatDropdown && repeatStatus) {
  repeatBtn.addEventListener('click', () => {
    repeatMode = !repeatMode;
    if (repeatMode) {
      rebuildRepeatDropdown();
      repeatDropdown.hidden = false;
      repeatBtn.classList.add('active');
      repeatStatus.textContent = 'Repeat mode ON — select a marker number below, then click on any photo to place it again.';
    } else {
      cancelRepeatMode();
    }
  });

  repeatDropdown.addEventListener('change', () => {
    const val = repeatDropdown.value;
    if (!val) {
      repeatSelection = null;
      repeatStatus.textContent = 'Repeat mode ON — select a marker number below, then click on any photo to place it again.';
      return;
    }
    const dashIdx = val.indexOf('-');
    const type = val.slice(0, dashIdx);
    const number = parseInt(val.slice(dashIdx + 1), 10);
    repeatSelection = { type, number };
    repeatStatus.textContent = `Repeat mode ON — click on any photo to place ${capitalize(type)} #${number} again.`;
  });
}

// ---------------------------
// Event Helpers
// ---------------------------

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

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

// Choose Image — starts/replaces the whole project
uploadImage.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (photos.length > 0) {
    const ok = confirm('This will start a new project and clear all existing photos and markers. Continue?');
    if (!ok) { uploadImage.value = ''; return; }
  }
  counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
  loadPhotoFromFile(file, { replace: true });
  uploadImage.value = '';
});

// Add Another Photo — appends to the current project, keeps counters going
if (addPhotoInput) {
  addPhotoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (photos.length === 0) {
      counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
    }
    loadPhotoFromFile(file, { replace: false });
    addPhotoInput.value = '';
  });
}

// Mode buttons
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.dataset.mode;
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Selecting a type button cancels Repeat Mode, so it never
    // silently sticks and hijacks the next click.
    if (repeatMode) cancelRepeatMode();
  });
});

// Canvas mouse events
canvas.addEventListener('mousedown', e => {
  const photo = getCurrentPhoto();
  if (!photo) return;
  const { x, y } = getMousePos(e);
  drawing = true;
  currentPath = [];
  const type = activeDrawType();
  if (type === 'screw' || type === 'bolt') {
    addMarker(type, [{ x, y }], activeRepeatNumber());
    drawing = false;
  } else {
    currentPath.push({ x, y });
  }
});

canvas.addEventListener('mousemove', e => {
  if (!drawing || !getCurrentPhoto()) return;
  const type = activeDrawType();
  if (type === 'component' || type === 'custom') {
    const { x, y } = getMousePos(e);
    currentPath.push({ x, y });
    redrawMarkers();
    ctx.strokeStyle = colorForType(type);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
});

canvas.addEventListener('mouseup', () => {
  if (!drawing) return;
  drawing = false;
  const type = activeDrawType();
  if (type === 'component' || type === 'custom') {
    if (currentPath.length > 0) addMarker(type, currentPath, activeRepeatNumber());
    currentPath = [];
  }
});

// Touch events
canvas.addEventListener('touchstart', e => {
  const photo = getCurrentPhoto();
  if (!photo) return;
  e.preventDefault();
  drawing = true;
  currentPath = [];
  const { x, y } = getTouchPos(e);
  const type = activeDrawType();
  if (type === 'screw' || type === 'bolt') {
    addMarker(type, [{ x, y }], activeRepeatNumber());
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
  const type = activeDrawType();
  if (type === 'component' || type === 'custom') {
    ctx.strokeStyle = colorForType(type);
    ctx.lineWidth = 3;
    ctx.beginPath();
    currentPath.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!drawing) return;
  drawing = false;
  const type = activeDrawType();
  if (type === 'component' || type === 'custom') {
    if (currentPath.length > 0) addMarker(type, currentPath, activeRepeatNumber());
    currentPath = [];
  }
}, { passive: false });

// Instructions — applies to the true last marker placed, across all photos
addInstructionsBtn.addEventListener('click', () => {
  if (actionHistory.length === 0) { alert('No markers yet!'); return; }
  const text = instructionsInput.value.trim();
  if (!text) { alert('Enter instructions first!'); return; }
  const last = actionHistory[actionHistory.length - 1];
  last.marker.instructions = text;
  rebuildMarkerList();
  instructionsInput.value = '';
});

// Undo — removes the true last marker placed, even if it's on another photo
undoBtn.addEventListener('click', () => {
  if (actionHistory.length === 0) { alert('No steps to undo!'); return; }
  const last = actionHistory.pop();
  const photo = photos[last.photoIndex];
  const idx = photo.markers.lastIndexOf(last.marker);
  if (idx !== -1) photo.markers.splice(idx, 1);
  if (!last.marker.isRepeat && counters[last.marker.type] > 1) {
    counters[last.marker.type]--;
  }
  if (last.photoIndex !== currentPhotoIndex) {
    switchPhoto(last.photoIndex);
  } else {
    rebuildMarkerList();
    redrawMarkers();
  }
});

// Export — bundles all photos, their markers, and the shared counters
exportBtn.addEventListener('click', () => {
  if (photos.length === 0) { alert('Load an image first!'); return; }
  const data = {
    counters,
    photos: photos.map(p => ({
      name: p.name,
      imageSrc: p.image.src,
      canvasWidth: p.canvasWidth,
      canvasHeight: p.canvasHeight,
      markers: p.markers
    }))
  };
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

// Import — supports the new multi-photo format and the old single-photo format
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);

      let photoDataList;
      if (Array.isArray(data.photos)) {
        photoDataList = data.photos;
      } else if (data.imageSrc) {
        // Backward compatibility with old single-photo project files
        photoDataList = [{
          name: 'Photo 1',
          imageSrc: data.imageSrc,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
          markers: data.markers || []
        }];
      } else {
        alert('Invalid project file!');
        return;
      }

      counters = data.counters || { screw: 1, bolt: 1, component: 1, custom: 1 };
      actionHistory = [];

      const loaded = new Array(photoDataList.length);
      let remaining = photoDataList.length;

      photoDataList.forEach((pd, i) => {
        const img = new Image();
        img.onload = () => {
          loaded[i] = {
            name: pd.name || `Photo ${i + 1}`,
            image: img,
            canvasWidth: pd.canvasWidth || img.width,
            canvasHeight: pd.canvasHeight || img.height,
            markers: pd.markers || []
          };
          remaining--;
          if (remaining === 0) {
            photos = loaded;
            photos.forEach((photo, idx) => {
              photo.markers.forEach(marker => actionHistory.push({ photoIndex: idx, marker }));
            });
            switchPhoto(0);
          }
        };
        img.src = pd.imageSrc;
      });
    } catch (err) {
      alert('Error loading project: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// Default: screw mode active
document.querySelector('.btn[data-mode="screw"]').classList.add('active');

// Initial empty state
canvas.hidden = true;
emptyState.hidden = false;
