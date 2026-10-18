import { PITVoice } from './sound.js';
class TankWarsPIT extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voice = new PITVoice(sampleRate);
    this.events = [];
    this.cursor = 0;
    this.port.onmessage = ({ data }) => {
      if (data.stop || data.replace) {
        this.events = [];
        this.cursor = 0;
        this.voice.write(null);
      }
      if (data.events) {
        this.events = this.events.slice(this.cursor).concat(data.events);
        this.cursor = 0;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      while (this.cursor < this.events.length && this.events[this.cursor][0] <= currentFrame + i)
        this.voice.write(this.events[this.cursor++][1]);
      out[i] = this.voice.sample();
    }
    if (this.cursor === this.events.length) {
      this.events = [];
      this.cursor = 0;
    }
    return true;
  }
}
registerProcessor('tank-wars-pit', TankWarsPIT);
