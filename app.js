// --- DOM refs ---
const uploadImage = document.getElementById('uploadImage');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');
const undoBtn = document.getElementById('undoBtn');
const addInstructionsBtn = document.getElementById('addInstructionsBtn');
const instructionsInput = document.getElementById('instructionsInput');
const markerList = document.getElementById('markerList');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Quick sanity checks
if (!markerList) console.error('markerList <ul> not found in DOM');

// --- State ---
let image = null;
let mode = 'screw'; // 'screw' | 'bolt' | 'component' | 'custom'
let markers = [];   // {type, x,y, number, instructions} or {type, path: [{x,y}...], number, instructions}
let counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
let drawing = false;
let currentPathMarker = null;

// --- Utilities ---
function getColor(type) {
  switch (type) {
    case 'screw': return '#28a745';   // green
    case 'bolt': return '#dc3545';    // red
    case 'component': return '#007bff'; // blue
    case 'custom': return '#ffc107';  // yellow
    default: return '#000';
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawImageToCanvas() {
  if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function redraw() {
  clearCanvas();
  drawImageToCanvas();
  drawAllMarkers();
}

function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function drawAllMarkers() {
  for (const m of markers) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = '16px Arial';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = getColor(m.type);
    ctx.fillStyle = getColor(m.type);

    if (m.type === 'screw' || m.type === 'bolt') {
      // Circle with number inside
      ctx.beginPath();
      ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      // center-ish number; tweak offsets if needed
      const txt = String(m.number);
      const tw = ctx.measureText(txt).width;
      ctx.fillText(txt, m.x - tw / 2, m.y - 8);
    } else {
      // Freehand shape + label in upper-left of bounds
      if (!m.path || m.path.length === 0) { ctx.restore(); continue; }

      ctx.beginPath();
      ctx.moveTo(m.path[0].x, m.path[0].y);
      for (let i = 1; i < m.path.length; i++) ctx.lineTo(m.path[i].x, m.path[i].y);
      // Close the shape so it’s easier to see
      ctx.closePath();
      ctx.stroke();

      // Label box
      const b = getPathBounds(m.path);
      ctx.fillStyle = getColor(m.type);
      ctx.fillRect(b.minX - 4, b.minY - 22, 22, 20);
      ctx.fillStyle = 'black';
      const txt = String(m.number);
      ctx.fillText(txt, b.minX, b.minY - 20);
    }
    ctx.restore();
  }
}

function getPathBounds(path) {
  let minX = path[0].x, maxX = path[0].x, minY = path[0].y, maxY = path[0].y;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function rebuildMarkerList() {
  if (!markerList) return;
  markerList.innerHTML = '';
  for (const m of markers) {
    const li = document.createElement('li');
    const label = m.type.charAt(0).toUpperCase() + m.type.slice(1);
    const instr = m.instructions && m.instructions.trim() ? ` — ${m.instructions.trim()}` : '';
    li.textContent = `#${m.number} (${label})${instr}`;
    markerList.appendChild(li);
  }
}

// --- Core actions ---
function addClickMarker(x, y) {
  const number = counters[mode]++;
  markers.push({ type: mode, x, y, number, instructions: '' });
  rebuildMarkerList();
  redraw();
}

function startFreehand(x, y) {
  const number = counters[mode]++;
  currentPathMarker = { type: mode, path: [{ x, y }], number, instructions: '' };
  markers.push(currentPathMarker);
  drawing = true;
  redraw();
}

function extendFreehand(x, y) {
  if (!drawing || !currentPathMarker) return;
  currentPathMarker.path.push({ x, y });
  redraw();
}

function finishFreehand() {
  if (!drawing) return;
  drawing = false;
  currentPathMarker = null;
  rebuildMarkerList(); // IMPORTANT: ensure the step appears
  redraw();
}

// --- Import/Export/Undo/Instructions ---
function exportProject() {
  if (!image) { alert('Load an image first.'); return; }
  const data = { imageSrc: image.src, markers };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jonnybox_project.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProject(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.imageSrc || !Array.isArray(data.markers)) throw new Error('Invalid file format.');
      image = new Image();
      image.onload = () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        markers = data.markers;
        // Rebuild counters
        counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
        for (const m of markers) {
          if (counters[m.type] <= m.number) counters[m.type] = m.number + 1;
        }
        rebuildMarkerList();
        redraw();
      };
      image.src = data.imageSrc;
    } catch (err) {
      alert('Could not load project: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function undoLast() {
  if (markers.length === 0) return;
  const last = markers.pop();
  counters[last.type] = Math.max(1, last.number); // roll back that counter
  rebuildMarkerList();
  redraw();
}

function addInstructionsToLast() {
  if (markers.length === 0) { alert('No steps yet.'); return; }
  const txt = (instructionsInput.value || '').trim();
  if (!txt) { alert('Type instructions first.'); return; }
  markers[markers.length - 1].instructions = txt;
  rebuildMarkerList();
  instructionsInput.value = '';
  alert('Instructions added to last step.');
}

// --- Event wiring ---
// Image load
uploadImage.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    image = new Image();
    image.onload = () => {
      // Set canvas to natural image size ONCE
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      // Reset state
      markers = [];
      counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
      rebuildMarkerList();
      redraw();
    };
    image.src = evt.target.result;
  };
  reader.readAsDataURL(f);
  e.target.value = '';
});

// Mode buttons (delegate on sidebar)
document.querySelector('.sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const newMode = btn.getAttribute('data-mode');
  if (newMode) mode = newMode;
});

importFile.addEventListener('change', importProject);
exportBtn.addEventListener('click', exportProject);
undoBtn.addEventListener('click', undoLast);
addInstructionsBtn.addEventListener('click', addInstructionsToLast);

// Canvas interactions
canvas.addEventListener('mousedown', (e) => {
  const { x, y } = getCanvasCoordinates(e);
  if (mode === 'screw' || mode === 'bolt') {
    addClickMarker(x, y);
  } else {
    startFreehand(x, y); // component/custom
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const { x, y } = getCanvasCoordinates(e);
  extendFreehand(x, y);
});
function endDrawIfAny() { if (drawing) finishFreehand(); }
canvas.addEventListener('mouseup', endDrawIfAny);
canvas.addEventListener('mouseleave', endDrawIfAny);
