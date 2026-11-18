
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
  var formatSelect = document.getElementById('formatSelect');
  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      controls.style.display = 'grid';
      Audaro.setStatus(statusEl, 'Ready. Choose an export format and click Convert.', 'ok');
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    Audaro.setStatus(statusEl, 'Converting...');
    var fmt = formatSelect.value === 'mp3' ? 'MP3 (192 kbps)' : 'WAV (lossless)';
    showResult(buffer, fileName + '-converted');
    Audaro.setStatus(statusEl, 'Done. Your file is ready as ' + fmt + ' — both WAV and MP3 downloads are available below.', 'ok');
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
