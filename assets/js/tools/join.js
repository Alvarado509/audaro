
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

  var controls = document.getElementById('controls');
  var moreInput = document.getElementById('moreInput');
  var fileListWrap = document.getElementById('fileListWrap');
  var fileList = document.getElementById('fileList');
  var items = []; // {file, buffer}
  fileInput.multiple = true;

  function renderList() {
    fileList.innerHTML = '';
    items.forEach(function (it, idx) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.className = 'fname';
      span.textContent = (idx + 1) + '. ' + it.file.name + ' (' + Audaro.formatTime(it.buffer.duration) + ')';
      li.appendChild(span);
      var up = document.createElement('button'); up.type = 'button'; up.textContent = 'Up';
      up.disabled = idx === 0;
      up.addEventListener('click', function () { var t = items[idx - 1]; items[idx - 1] = items[idx]; items[idx] = t; renderList(); });
      var down = document.createElement('button'); down.type = 'button'; down.textContent = 'Down';
      down.disabled = idx === items.length - 1;
      down.addEventListener('click', function () { var t = items[idx + 1]; items[idx + 1] = items[idx]; items[idx] = t; renderList(); });
      var del = document.createElement('button'); del.type = 'button'; del.textContent = 'Remove';
      del.addEventListener('click', function () { items.splice(idx, 1); renderList(); updateState(); });
      li.appendChild(up); li.appendChild(down); li.appendChild(del);
      fileList.appendChild(li);
    });
    fileListWrap.style.display = items.length ? 'block' : 'none';
  }
  function updateState() {
    if (items.length) {
      controls.style.display = 'grid';
      var total = items.reduce(function (s, it) { return s + it.buffer.duration; }, 0);
      Audaro.setStatus(statusEl, items.length + ' file(s), total ' + Audaro.formatTime(total) + '. Arrange the order, then click Join.', 'ok');
    }
  }
  function addFiles(files) {
    var list = Array.prototype.slice.call(files);
    Audaro.setStatus(statusEl, 'Opening ' + list.length + ' file(s)...');
    var pending = list.length;
    list.forEach(function (file) {
      file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
        items.push({ file: file, buffer: buf });
        if (--pending === 0) { renderList(); updateState(); }
      }).catch(function () {
        if (--pending === 0) { renderList(); updateState(); }
        Audaro.setStatus(statusEl, 'One file could not be opened. Try an MP3, WAV or OGG file.', 'error');
      });
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, addFiles, statusEl);
  moreInput.addEventListener('change', function () { if (moreInput.files.length) addFiles(moreInput.files); });

  processBtn.addEventListener('click', function () {
    if (items.length < 2) { Audaro.setStatus(statusEl, 'Add at least 2 files to join.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Joining ' + items.length + ' files...');
    var sr = items[0].buffer.sampleRate;
    var totalLen = items.reduce(function (s, it) { return s + it.buffer.length; }, 0);
    var out = Audaro.audioCtx().createBuffer(2, totalLen, sr);
    var pos = 0;
    items.forEach(function (it) {
      var buf = it.buffer;
      for (var ch = 0; ch < 2; ch++) {
        var src = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
        out.getChannelData(ch).set(src, pos);
      }
      pos += buf.length;
    });
    fileName = 'audaro-joined';
    showResult(out, 'audaro-joined');
    Audaro.setStatus(statusEl, 'Done. Merged ' + items.length + ' files into one track of ' + Audaro.formatTime(out.duration) + '.', 'ok');
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
