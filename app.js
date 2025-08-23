const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const uploadImage = document.getElementById('uploadImage');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');

const instructionsInput = document.getElementById('instructionsInput');
const addInstructionsBtn = document.getElementById('addInstructionsBtn');

const markerList = document.getElementById('markerList');
const modeButtons = document.querySelectorAll('.btn[data-mode]');
const undoBtn = document.getElementById('undoBtn');

let image = new Image();
let currentMode = 'screw';

let counters = { screw: 1, bolt: 1, component: 1, custom: 1 };
let markers = [];

let drawing = false;
let currentPath = [];

function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
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
    } else {
      ctx.strokeStyle = colorForType(marker.type);
      ctx.lineWidth = 3;
      ctx.beginPath();
      marker.points.forEach((p, i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
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

function colorForType(type){
  switch(type){
    case 'screw': return '#28a745';
    case 'bolt': return '#dc3545';
    case 'component': return '#007bff';
    case 'custom': return '#ffc107';
    default: return '#000';
  }
}

function rebuildMarkerList(){
  markerList.innerHTML = '';
  markers.forEach(marker => {
    const li = document.createElement('li');
    li.textContent = `#${marker.number} (${marker.type})` + (marker.instructions ? `: ${marker.instructions}` : '');
    markerList.appendChild(li);
  });
}

function addMarker(type, points){
  const number = counters[type]++;
  markers.push({ type, number, points, instructions: '' });
  rebuildMarkerList();
  redrawMarkers();
}

function resizeCanvasToImage(){
  const maxWidth = window.innerWidth - 300;
  const maxHeight = window.innerHeight - 40;
  let w = image.width;
  let h = image.height;
  if(w>maxWidth){ h*= maxWidth/w; w=maxWidth; }
  if(h>maxHeight){ w*= maxHeight/h; h=maxHeight; }
  canvas.width = w;
  canvas.height = h;
  redrawMarkers();
}

// Load image
uploadImage.addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    image = new Image();
    image.onload = ()=>resizeCanvasToImage();
    image.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

// Mode buttons
modeButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    currentMode = btn.getAttribute('data-mode');
    modeButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Canvas drawing
canvas.addEventListener('mousedown', e=>{
  if(!image.src) return;
  drawing=true; currentPath=[];
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX-rect.left, y=e.clientY-rect.top;
  if(currentMode==='screw'||currentMode==='bolt'){
    addMarker(currentMode, [{x,y}]);
    drawing=false;
  } else currentPath.push({x,y});
});

canvas.addEventListener('mousemove', e=>{
  if(!drawing) return; if(!image.src) return;
  if(currentMode==='component'||currentMode==='custom'){
    const rect = canvas.getBoundingClientRect();
    currentPath.push({x: e.clientX-rect.left, y: e.clientY-rect.top});
    redrawMarkers();
    ctx.strokeStyle=colorForType(currentMode); ctx.lineWidth=3;
    ctx.beginPath(); currentPath.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  }
});

canvas.addEventListener('mouseup', e=>{
  if(!drawing) return;
  drawing=false;
  if(currentMode==='component'||currentMode==='custom'){
    if(currentPath.length>2) addMarker(currentMode,currentPath);
    currentPath=[];
  }
});

// Instructions
addInstructionsBtn.addEventListener('click', ()=>{
  if(markers.length===0){ alert('No markers yet!'); return; }
  const text=instructionsInput.value.trim();
  if(!text){ alert('Enter instructions first!'); return; }
  markers[markers.length-1].instructions=text;
  rebuildMarkerList();
  instructionsInput.value='';
});

// Undo
undoBtn.addEventListener('click', ()=>{
  if(markers.length===0){ alert('No steps to undo!'); return; }
  const removed = markers.pop();
  if(counters[removed.type]>1) counters[removed.type]--;
  rebuildMarkerList(); redrawMarkers();
});

// Export
exportBtn.addEventListener('click', ()=>{
  if(!image.src){ alert('Load an image first!'); return; }
  const data={imageSrc:image.src,canvasWidth:canvas.width,canvasHeight:canvas.height,counters,markers};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  let filename=prompt('Enter filename:', 'jonnybox_project.json'); if(!filename) filename='jonnybox_project.json';
  a.download=filename; a.click(); URL.revokeObjectURL(url);
});

// Import
importFile.addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=evt=>{
    try{
      const data=JSON.parse(evt.target.result);
      if(!data.imageSrc||!data.markers){ alert('Invalid project file!'); return; }
      image=new Image();
      image.onload=()=>{
        canvas.width=data.canvasWidth||image.width;
        canvas.height=data.canvasHeight||image.height;
        counters=data.counters||{screw:1,bolt:1,component:1,custom:1};
        markers=data.markers||[];
        redrawMarkers(); rebuildMarkerList();
      };
      image.src=data.imageSrc;
    }catch(err){ alert('Error loading project: '+err.message); }
  };
  reader.readAsText(file);
});

// Default
document.querySelector('.btn[data-mode="screw"]').classList.add('active');

// Hide welcome text when image loads
uploadImage.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    image = new Image();
    image.onload = () => {
      document.getElementById('welcomeText').style.display = 'none';
      resizeCanvasToImage();
      redrawMarkers();
    };
    image.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

// Hide welcome text when importing a project
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      image = new Image();
      image.onload = () => {
        document.getElementById('welcomeText').style.display = 'none';
        canvas.width = data.canvasWidth || image.width;
        canvas.height = data.canvasHeight || image.height;
        counters = data.counters || { screw:1, bolt:1, component:1, custom:1 };
        markers = data.markers || [];
        redrawMarkers();
        rebuildMarkerList();
      };
      image.src = data.imageSrc;
    } catch(err) { alert('Error loading project: ' + err.message); }
  };
  reader.readAsText(file);
});
