
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
  var gain = document.getElementById('gain');
  var gainVal = document.getElementById('gainVal');
  var normalize = document.getElementById('normalize');
  gain.addEventListener('input', function () { gainVal.textContent = gain.value + '%'; });
  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      controls.style.display = 'grid';
      Audaro.setStatus(statusEl, 'Ready. Set the boost and click Boost volume.', 'ok');
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Adjusting volume...');
    var g = parseFloat(gain.value) / 100;
    var chans = [];
    var peakBefore = Audaro.peak(buffer);
    for (var c = 0; c < buffer.numberOfChannels; c++) {
      var src = buffer.getChannelData(c);
      var out = new Float32Array(src.length);
      for (var i = 0; i < src.length; i++) out[i] = src[i] * g;
      chans.push(out);
    }
    var peakAfter = 0;
    chans.forEach(function (d) { for (var i = 0; i < d.length; i += 4) { var a = Math.abs(d[i]); if (a > peakAfter) peakAfter = a; } });
    var note = '';
    if (normalize.checked) {
      var target = 0.891; // -1 dBFS
      if (peakAfter > 0) {
        var scale = target / peakAfter;
        chans = chans.map(function (d) { var o = new Float32Array(d.length); for (var j = 0; j < d.length; j++) o[j] = d[j] * scale; return o; });
        note = 'Normalized to -1 dBFS.';
      }
    } else if (peakAfter > 1) {
      var lim = 0.99 / peakAfter;
      chans = chans.map(function (d) { var o = new Float32Array(d.length); for (var j = 0; j < d.length; j++) o[j] = d[j] * lim; return o; });
      note = 'Peak exceeded 0 dBFS — output limited to prevent clipping.';
    }
    var outBuf = Audaro.bufferFromChannelData(chans, buffer.sampleRate);
    showResult(outBuf, fileName + '-louder');
    Audaro.setStatus(statusEl, 'Done. Peak was ' + (peakBefore * 100).toFixed(0) + '% and is now ' + (Audaro.peak(outBuf) * 100).toFixed(0) + '%. ' + note, 'ok');
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
