import * as utils from './utils.js';

const BEEP = 'beep';
// Duration of beep in seconds.
const BEEP_DURATION = 0.05;

class Audio {
  constructor() {
    /** @type {!AudioContext} */
    this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    this.baseLatency = 0;

    /** @type {boolean} Whether audio context has been unlocked. */
    this.unlocked = false;

    this.sampleUrlsMap = {
      'hihat': 'static/sounds/hihat.wav'
    };

    // Map name to buffer.
    this.buffers = {};

    this.uiData = {
      sampleName: BEEP,
    }
  }

  // Play silent buffer to unlock the audio.
  unlockAudio() {
    if (!this.unlocked) {
      var buffer = this.audioContext.createBuffer(1, 1, 22050);
      var node = this.audioContext.createBufferSource();
      node.buffer = buffer;
      node.start(0);
      this.unlocked = true;
    }
  }

  getAudioContext() {
    return this.audioContext;
  }

  /**
   * Returns audioContext.baseLatency.
   *
   * .baseLatency is not supported in a few browsers, including Safari and
   * Firefox-on-Android.
   * See https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency
   */
  getBaseLatency() {
    if (this.baseLatency != 0) {
      return this.baseLatency;
    }
    if (this.audioContext.state === 'running'
        && 'baseLatency' in this.audioContext) {
      this.baseLatency = this.audioContext.baseLatency;
      utils.log('AudioContext base latency: $ secs',
          this.baseLatency.toFixed(6));
      return this.baseLatency;
    }
    return 0;
  }

  getUiData() {
    return this.uiData;
  }

  /**
   * Schedule the sound at startTime. beatNumber from 0 to 15 (16th notes).
   */
  scheduleSound(beatNumber, noteTime) {
    if (this.uiData.sampleName == BEEP) {
      let freq;
      if (beatNumber % 16 === 0) {  // beat 0 = high pitch
        freq = 880.0;
      } else if (beatNumber % 4 === 0) {  // quarter notes = medium pitch
        freq = 440.0;
      } else {  // other 16th notes = low pitch
        freq = 220.0;
      }
      let osc = this.audioContext.createOscillator();
      osc.connect(this.audioContext.destination);
      osc.frequency.value = freq;
      osc.start(noteTime);
      osc.stop(noteTime + BEEP_DURATION);
    } else {
      if (!(this.uiData.sampleName in this.buffers)) {
        utils.warn('sample not in sample map: $', this.uiData.sampleName);
        return;
      }
      let node = this.audioContext.createBufferSource();
      node.buffer = this.buffers[this.uiData.sampleName];
      node.connect(this.audioContext.destination);
      node.start(noteTime);
    }
  }

  maybeLoadSample() {
    if (this.uiData.sampleName == BEEP) {
      return;
    }
    // Only load new sample if it hasn't been loaded before.
    if (!(this.uiData.sampleName in this.buffers)) {
      utils.log('Loading sample: $', this.uiData.sampleName);
      new BufferLoader(this.audioContext, [this.uiData.sampleName], this.sampleUrlsMap, (buffers) => {
        Object.keys(buffers).forEach((key, index) => {
          // Insert the fetched buffer along with existing buffers, so we don't
          // re-load.
          this.buffers[key] = buffers[key];
        });
      }).load();
    }
  }

  loadSamples() {
  }
}

class BufferLoader {
  constructor(context, sampleNames, sampleUrlsMap, callback) {
    this.context = context;
    this.sampleNames = sampleNames;
    this.sampleUrlsMap = sampleUrlsMap;
    this.onload = callback;
    this.buffers = {};
    this.loadCount = 0;
  }

  load() {
    for (var i = 0; i < this.sampleNames.length; ++i) {
      this.loadBuffer(this.sampleNames[i]);
    }
  }

  loadBuffer(sampleName) {
    let url = this.sampleUrlsMap[sampleName];
    // Load buffer asynchronously
    let request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    let loader = this;

    request.onload = function() {
      // Asynchronously decode the audio file data in request.response
      loader.context.decodeAudioData(
        request.response,
        function(buffer) {
          if (!buffer) {
            alert('Failed to decode sound file :( ' + url);
            return;
          }
          loader.buffers[sampleName] = buffer;
          if (++loader.loadCount == loader.sampleNames.length)
            loader.onload(loader.buffers);
        },
        function(error) {
          console.error('Failed to decode sound file :(', error);
        }
      );
    }
    request.onerror = function() {
      alert('Failed to load sound files :(');
    }

    request.send();
  }
}

export {Audio};
