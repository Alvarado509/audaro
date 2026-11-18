
(function () {
  'use strict';
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('fileInput');
  var fileInfo = document.getElementById('fileInfo');
  var statusEl = document.getElementById('status');
  var result = document.getElementById('result');
  var resultInfo = document.getElementById('resultInfo');
  var player = document.getElementById('audioPlayer');
  var dlWav = document.getElementById('dlWav');
  var dlMp3 = document.getElementById('dlMp3');
  var processBtn = document.getElementById('processBtn');
  var buffer = null, fileName = 'audaro';

  var canvas = document.getElementById('waveCanvas');
  var waveWrap = document.getElementById('waveWrap');
  var controls = document.getElementById('controls');
  var startInput = document.getElementById('startInput');
  var endInput = document.getElementById('endInput');
  var timeStart = document.getElementById('timeStart');
  var timeEnd = document.getElementById('timeEnd');
  var sel = { start: 0, end: 0 };
  var dragging = false;

  function redraw() { if (buffer) Audaro.drawWaveform(canvas, buffer, sel); }
  function syncInputs() {
    startInput.value = sel.start.toFixed(1);
    endInput.value = sel.end.toFixed(1);
    timeStart.textContent = Audaro.formatTime(sel.start);
    timeEnd.textContent = Audaro.formatTime(sel.end);
    redraw();
  }
  function timeFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    return Math.max(0, Math.min(buffer.duration, x * buffer.duration));
  }
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; canvas.setPointerCapture(e.pointerId);
    var t = timeFromEvent(e); sel.start = t; sel.end = t; syncInputs();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var t = timeFromEvent(e);
    if (t < sel.start) { sel.end = sel.start; sel.start = t; } else { sel.end = t; }
    syncInputs();
  });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  startInput.addEventListener('change', function () {
    sel.start = Math.max(0, Math.min(parseFloat(startInput.value) || 0, buffer.duration));
    if (sel.end < sel.start) sel.end = sel.start;
    syncInputs();
  });
  endInput.addEventListener('change', function () {
    sel.end = Math.max(0, Math.min(parseFloat(endInput.value) || 0, buffer.duration));
    if (sel.start > sel.end) sel.start = sel.end;
    syncInputs();
  });
  window.addEventListener('resize', redraw);

  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      sel = { start: 0, end: buf.duration };
      waveWrap.style.display = 'block';
      controls.style.display = 'grid';
      syncInputs();
      Audaro.setStatus(statusEl, 'Ready. Drag on the waveform to select the part to keep.', 'ok');
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    if (sel.end - sel.start < 0.05) { Audaro.setStatus(statusEl, 'Selection is too short. Drag a wider selection.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Cutting...');
    var sr = buffer.sampleRate;
    var s0 = Math.floor(sel.start * sr), s1 = Math.floor(sel.end * sr);
    var out = Audaro.audioCtx().createBuffer(buffer.numberOfChannels, s1 - s0, sr);
    for (var c = 0; c < buffer.numberOfChannels; c++) {
      out.getChannelData(c).set(buffer.getChannelData(c).subarray(s0, s1));
    }
    showResult(out, fileName + '-cut');
    Audaro.setStatus(statusEl, 'Done. Your clip is ' + Audaro.formatTime(out.duration) + ' long.', 'ok');
  });

  function showResult(buf, baseName, extraInfo) {
    var wavUrl = URL.createObjectURL(Audaro.bufferToWav(buf));
    player.src = wavUrl;
    Audaro.bindDownloads(buf, baseName, dlWav, dlMp3, resultInfo);
    if (extraInfo) resultInfo.innerHTML += ' &middot; ' + extraInfo;
    result.classList.add('show');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

})();
