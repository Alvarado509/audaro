
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
  var threshold = document.getElementById('threshold');
  var thresholdVal = document.getElementById('thresholdVal');
  var minDur = document.getElementById('minDur');
  var minDurVal = document.getElementById('minDurVal');
  threshold.addEventListener('input', function () { thresholdVal.textContent = threshold.value + ' dB'; });
  minDur.addEventListener('input', function () { minDurVal.textContent = parseFloat(minDur.value).toFixed(1) + ' s'; });
  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      controls.style.display = 'grid';
      Audaro.setStatus(statusEl, 'Ready. Set the threshold and click Remove silence.', 'ok');
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Detecting silence...');
    var sr = buffer.sampleRate;
    var win = Math.floor(sr * 0.01); // 10 ms windows
    var threshAmp = Math.pow(10, parseFloat(threshold.value) / 20);
    var minSil = parseFloat(minDur.value);
    var pad = Math.floor(sr * 0.05);
    var data = buffer.getChannelData(0);
    var nWin = Math.floor(data.length / win);
    var loud = new Array(nWin).fill(false);
    for (var w = 0; w < nWin; w++) {
      var peak = 0;
      for (var i = w * win; i < (w + 1) * win; i += 2) {
        var a = Math.abs(data[i]); if (a > peak) peak = a;
      }
      loud[w] = peak >= threshAmp;
    }
    // Keep loud windows, plus short silences below minDur (they are natural pauses).
    var keep = loud.slice();
    var run = 0;
    for (var k = 0; k <= nWin; k++) {
      if (k < nWin && !loud[k]) { run++; continue; }
      if (run > 0 && run * 0.01 < minSil) { for (var m = k - run; m < k; m++) keep[m] = true; }
      run = 0;
    }
    var keptSamples = 0;
    for (var q = 0; q < nWin; q++) if (keep[q]) keptSamples += win;
    var out = Audaro.audioCtx().createBuffer(buffer.numberOfChannels, Math.max(1, keptSamples), sr);
    var pos = 0;
    for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
      var src = buffer.getChannelData(ch), dst = out.getChannelData(ch);
      var p = 0;
      for (var w2 = 0; w2 < nWin; w2++) {
        if (!keep[w2]) continue;
        var s0 = Math.max(0, w2 * win - (w2 === 0 || !keep[w2 - 1] ? pad : 0));
        var s1 = Math.min(data.length, (w2 + 1) * win + (w2 === nWin - 1 || !keep[w2 + 1] ? pad : 0));
        var len = Math.min(s1 - s0, dst.length - p);
        if (len > 0) { dst.set(src.subarray(s0, s0 + len), p); p += len; }
      }
      if (ch === 0) pos = p;
    }
    // Trim trailing padding beyond actual copied length.
    var finalLen = pos;
    var finalBuf = Audaro.audioCtx().createBuffer(buffer.numberOfChannels, Math.max(1, finalLen), sr);
    for (var c2 = 0; c2 < buffer.numberOfChannels; c2++) {
      finalBuf.getChannelData(c2).set(out.getChannelData(c2).subarray(0, finalLen));
    }
    var removed = buffer.duration - finalBuf.duration;
    showResult(finalBuf, fileName + '-no-silence');
    Audaro.setStatus(statusEl, 'Done. Removed ' + removed.toFixed(1) + ' s of silence — new duration ' + Audaro.formatTime(finalBuf.duration) + '. Listen before downloading.', 'ok');
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
