// Synthesised sound: every effect is an oscillator through WebAudio, no audio
// files. Created lazily on the first user gesture so browsers allow it; every
// call is a no-op until then.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    alarmOn: false,
    alarmTimer: null,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.22;
      audio.master.connect(audio.ctx.destination);
    } catch (err) {
      audio.ctx = null;
    }
  };

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!audio.ctx || !audio.master) return;
    const t0 = audio.ctx.currentTime + (when || 0);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.5, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  audio.click = function click() { tone(660, 0.07, 'square', 0.25); };
  audio.pickup = function pickup() {
    tone(880, 0.09, 'sine', 0.5);
    tone(1318, 0.14, 'sine', 0.45, 0.07);
  };
  audio.diamond = function diamond() {
    tone(523, 0.12, 'triangle', 0.5);
    tone(784, 0.12, 'triangle', 0.5, 0.1);
    tone(1046, 0.22, 'triangle', 0.5, 0.2);
    tone(1568, 0.3, 'sine', 0.4, 0.3);
  };
  audio.spotted = function spotted() {
    tone(220, 0.16, 'sawtooth', 0.5, 0, 440);
    tone(440, 0.16, 'sawtooth', 0.4, 0.14, 220);
  };
  audio.caught = function caught() {
    tone(392, 0.22, 'sawtooth', 0.55, 0, 196);
    tone(311, 0.22, 'sawtooth', 0.55, 0.2, 155);
    tone(233, 0.5, 'sawtooth', 0.55, 0.4, 110);
  };
  audio.win = function win() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.5, i * 0.13));
  };
  audio.unlock = function unlock() {
    tone(330, 0.08, 'square', 0.35);
    tone(495, 0.12, 'square', 0.35, 0.09);
  };

  /** A two-tone alarm pulse while the meter is high; call every frame. */
  audio.alarmPulse = function alarmPulse(alarm, dt) {
    if (!audio.ctx) return;
    if (alarm < 55) return;
    audio.alarmTimer = (audio.alarmTimer || 0) + dt;
    const interval = alarm > 85 ? 0.45 : 0.9;
    if (audio.alarmTimer >= interval) {
      audio.alarmTimer = 0;
      tone(740, 0.14, 'square', 0.22);
      tone(554, 0.14, 'square', 0.22, 0.16);
    }
  };

  return audio;
}
