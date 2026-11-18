
import { SoundTouch, SimpleFilter, WebAudioBufferSource } from '../soundtouch.js';
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
  var controls = document.getElementById('controls');
  var rate = document.getElementById('rate');
  var rateVal = document.getElementById('rateVal');
  var preservePitch = document.getElementById('preservePitch');
  var buffer = null, fileName = 'audaro';
  rate.addEventListener('input', function () { rateVal.textContent = parseFloat(rate.value).toFixed(2) + 'x'; });

  function showResult(buf, baseName) {
    var wavUrl = URL.createObjectURL(Audaro.bufferToWav(buf));
    player.src = wavUrl;
    Audaro.bindDownloads(buf, baseName, dlWav, dlMp3, resultInfo);
    result.classList.add('show');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function loadFile(file) {
    Audaro.setStatus(statusEl, 'Opening ' + file.name + '...');
    file.arrayBuffer().then(function (ab) { return Audaro.decode(ab); }).then(function (buf) {
      buffer = buf; fileName = file.name.replace(/\.[^.]+$/, '');
      Audaro.showFileInfo(fileInfo, file, buf);
      controls.style.display = 'grid';
      Audaro.setStatus(statusEl, 'Ready. Pick a speed and click Change speed.', 'ok');
    }).catch(function () {
      Audaro.setStatus(statusEl, 'Could not open that file. Try an MP3, WAV or OGG file.', 'error');
    });
  }
  Audaro.setupDropzone(dropzone, fileInput, function (files) { loadFile(files[0]); }, statusEl);

  function renderSoundTouch(buf, rateVal) {
    var st = new SoundTouch();
    st.tempo = rateVal;
    var source = new WebAudioBufferSource(buf);
    var filter = new SimpleFilter(source, st);
    var chunks = [];
    var chunk = new Float32Array(4096 * 2);
    var total = 0, guard = 0;
    var n;
    while ((n = filter.extract(chunk, 4096)) > 0) {
      chunks.push(chunk.slice(0, n * 2));
      total += n;
      if (++guard > 20000) break;
    }
    var out = Audaro.audioCtx().createBuffer(2, Math.max(1, total), buf.sampleRate);
    var pos = 0;
    chunks.forEach(function (c) {
      for (var i = 0; i < c.length; i += 2) {
        out.getChannelData(0)[pos] = c[i];
        out.getChannelData(1)[pos] = c[i + 1];
        pos++;
      }
    });
    return out;
  }
  function renderResample(buf, rateVal) {
    var newLen = Math.max(1, Math.round(buf.length / rateVal));
    var chans = [];
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var src = buf.getChannelData(c);
      var dst = new Float32Array(newLen);
      for (var i = 0; i < newLen; i++) {
        var p = i * rateVal;
        var i0 = Math.floor(p), i1 = Math.min(src.length - 1, i0 + 1), f = p - i0;
        dst[i] = src[i0] * (1 - f) + src[i1] * f;
      }
      chans.push(dst);
    }
    return Audaro.bufferFromChannelData(chans, buf.sampleRate);
  }

  processBtn.addEventListener('click', function () {
    if (!buffer) { Audaro.setStatus(statusEl, 'Choose an audio file first.', 'error'); return; }
    var r = parseFloat(rate.value);
    Audaro.setStatus(statusEl, 'Changing speed to ' + r.toFixed(2) + 'x...');
    setTimeout(function () {
      try {
        var out = preservePitch.checked ? renderSoundTouch(buffer, r) : renderResample(buffer, r);
        showResult(out, fileName + '-' + r.toFixed(2).replace('.', '_') + 'x');
        Audaro.setStatus(statusEl, 'Done. New duration ' + Audaro.formatTime(out.duration) +
          (preservePitch.checked ? ' (pitch preserved).' : ' (pitch changed, tape-style).'), 'ok');
      } catch (err) {
        Audaro.setStatus(statusEl, 'Speed change failed in this browser. Try turning off "Preserve pitch".', 'error');
      }
    }, 30);
  });
})();
