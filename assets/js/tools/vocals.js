
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
  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      controls.style.display = 'grid';
      if (buf.numberOfChannels < 2) {
        Audaro.setStatus(statusEl, 'This file is mono. Vocal removal needs a stereo file, because it compares the left and right channels.', 'error');
      } else {
        Audaro.setStatus(statusEl, 'Ready. Click "Remove vocals".', 'ok');
      }
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    if (buffer.numberOfChannels < 2) { Audaro.setStatus(statusEl, 'This file is mono. Vocal removal needs a stereo file.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Removing vocals...');
    var left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    var outL = new Float32Array(buffer.length), outR = new Float32Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
      var v = (left[i] - right[i]) * 0.5;
      outL[i] = v; outR[i] = v;
    }
    var out = Audaro.bufferFromChannelData([outL, outR], buffer.sampleRate);
    showResult(out, fileName + '-instrumental');
    Audaro.setStatus(statusEl, 'Done. Best on stereo songs with centered vocals — results vary.', 'ok');
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
