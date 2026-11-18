
/* Audaro audio-core: shared decode / encode / export helpers (all local, Web Audio API). */
(function (global) {
  'use strict';
  var ctx = null;
  var FREE_MAX_BYTES = 100 * 1024 * 1024; /* Free plan: files up to 100 MB. Premium (coming soon) accepts larger files. */
  function audioCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function decode(arrayBuffer) {
    return audioCtx().decodeAudioData(arrayBuffer.slice(0));
  }
  function makeBuffer(channels, length, sampleRate) {
    return audioCtx().createBuffer(channels, length, sampleRate);
  }
  function bufferFromChannelData(arrays, sampleRate) {
    var buf = makeBuffer(arrays.length, arrays[0].length, sampleRate);
    for (var c = 0; c < arrays.length; c++) buf.getChannelData(c).set(arrays[c]);
    return buf;
  }
  function floatToInt16(floatArr) {
    var out = new Int16Array(floatArr.length);
    for (var i = 0; i < floatArr.length; i++) {
      var s = Math.max(-1, Math.min(1, floatArr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }
  function channelsAsInt16(buffer) {
    var chans = [];
    var n = Math.min(buffer.numberOfChannels, 2);
    for (var c = 0; c < n; c++) chans.push(floatToInt16(buffer.getChannelData(c)));
    if (n === 1) chans.push(chans[0]); // lamejs stereo path needs two channels; mono handled separately
    return chans;
  }
  function bufferToWav(buffer) {
    var numCh = Math.min(buffer.numberOfChannels, 2);
    var sampleRate = buffer.sampleRate;
    var length = buffer.length * numCh * 2;
    var ab = new ArrayBuffer(44 + length);
    var view = new DataView(ab);
    function wstr(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    wstr(0, 'RIFF'); view.setUint32(4, 36 + length, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCh * 2, true); view.setUint16(32, numCh * 2, true);
    view.setUint16(34, 16, true); wstr(36, 'data'); view.setUint32(40, length, true);
    var offset = 44;
    var chans = [];
    for (var c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
    for (var i = 0; i < buffer.length; i++) {
      for (var ch = 0; ch < numCh; ch++) {
        var s = Math.max(-1, Math.min(1, chans[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }
  function bufferToMp3(buffer, kbps) {
    kbps = kbps || 192;
    var numCh = Math.min(buffer.numberOfChannels, 2);
    var encoder = new lamejs.Mp3Encoder(numCh, buffer.sampleRate, kbps);
    var data = [];
    var blockSize = 1152;
    var chans = channelsAsInt16(buffer);
    if (numCh === 1) {
      for (var i = 0; i < buffer.length; i += blockSize) {
        var chunk = chans[0].subarray(i, i + blockSize);
        var enc = encoder.encodeBuffer(chunk);
        if (enc.length) data.push(new Int8Array(enc));
      }
    } else {
      for (var j = 0; j < buffer.length; j += blockSize) {
        var left = chans[0].subarray(j, j + blockSize);
        var right = chans[1].subarray(j, j + blockSize);
        var enc2 = encoder.encodeBuffer(left, right);
        if (enc2.length) data.push(new Int8Array(enc2));
      }
    }
    var end = encoder.flush();
    if (end.length) data.push(new Int8Array(end));
    return new Blob(data, { type: 'audio/mpeg' });
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }
  function formatTime(sec) {
    if (!isFinite(sec)) return '0:00';
    sec = Math.max(0, sec);
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function peak(buffer) {
    var max = 0;
    for (var c = 0; c < buffer.numberOfChannels; c++) {
      var d = buffer.getChannelData(c);
      for (var i = 0; i < d.length; i += 4) { var a = Math.abs(d[i]); if (a > max) max = a; }
    }
    return max;
  }
  function drawWaveform(canvas, buffer, sel) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    var data = buffer.getChannelData(0);
    var step = Math.max(1, Math.floor(data.length / w));
    g.fillStyle = '#E5322D';
    for (var x = 0; x < w; x++) {
      var min = 1, max = -1;
      var start = x * step;
      for (var i = start; i < start + step && i < data.length; i += 4) {
        var v = data[i]; if (v < min) min = v; if (v > max) max = v;
      }
      var y1 = (1 - max) * h / 2, y2 = (1 - min) * h / 2;
      g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
    if (sel) {
      var x0 = sel.start / buffer.duration * w, x1 = sel.end / buffer.duration * w;
      g.fillStyle = 'rgba(229,50,45,.18)';
      g.fillRect(0, 0, x0, h); g.fillRect(x1, 0, w - x1, h);
      g.fillStyle = '#E5322D';
      g.fillRect(x0 - 1, 0, 2, h); g.fillRect(x1 - 1, 0, 2, h);
    }
  }
  function setupDropzone(zone, input, onFiles, statusEl) {
    function handleFiles(files) {
      if (!files || !files.length) return;
      var ok = [], rejected = 0;
      for (var i = 0; i < files.length; i++) {
        if (files[i].size > FREE_MAX_BYTES) rejected++;
        else ok.push(files[i]);
      }
      if (rejected && statusEl) {
        setStatus(statusEl, 'Free plan: files up to 100 MB. ' + rejected + ' file(s) too large \u2014 Premium (coming soon) accepts larger files.', 'error');
      }
      if (ok.length) onFiles(ok);
    }
    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
    });
    zone.addEventListener('drop', function (e) {
      var files = e.dataTransfer.files;
      if (files && files.length) handleFiles(files);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files.length) handleFiles(input.files);
    });
  }
  function showFileInfo(el, file, buffer) {
    el.style.display = 'block';
    el.innerHTML = '<b>' + escapeHtml(file.name) + '</b> &middot; ' + formatBytes(file.size) +
      ' &middot; ' + formatTime(buffer.duration) + ' &middot; ' +
      buffer.sampleRate.toLocaleString() + ' Hz &middot; ' +
      (buffer.numberOfChannels === 1 ? 'Mono' : buffer.numberOfChannels === 2 ? 'Stereo' : buffer.numberOfChannels + ' channels');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  function bindDownloads(resultBuffer, baseName, wavBtn, mp3Btn, infoEl) {
    var wav = bufferToWav(resultBuffer);
    var mp3 = bufferToMp3(resultBuffer);
    window.__audaroLast = { wav: wav, mp3: mp3, buffer: resultBuffer };
    wavBtn.onclick = function () { download(wav, baseName + '.wav'); };
    mp3Btn.onclick = function () { download(mp3, baseName + '.mp3'); };
    if (infoEl) {
      infoEl.innerHTML = 'Result: <b>' + formatTime(resultBuffer.duration) + '</b> &middot; WAV ' +
        formatBytes(wav.size) + ' &middot; MP3 ' + formatBytes(mp3.size);
    }
    return { wav: wav, mp3: mp3 };
  }
  global.Audaro = {
    audioCtx: audioCtx, decode: decode, makeBuffer: makeBuffer,
    bufferFromChannelData: bufferFromChannelData, bufferToWav: bufferToWav,
    bufferToMp3: bufferToMp3, download: download, formatTime: formatTime,
    formatBytes: formatBytes, peak: peak, drawWaveform: drawWaveform,
    setupDropzone: setupDropzone, showFileInfo: showFileInfo,
    escapeHtml: escapeHtml, setStatus: setStatus, bindDownloads: bindDownloads,
    FREE_MAX_BYTES: FREE_MAX_BYTES
  };
})(window);
