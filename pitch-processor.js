class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.THRESHOLD = 0.1; // Более строгий порог
    this.RMS_TRESHOLD = 0.002;
    this.SEMITONE_COEFF = 1.0594630943592952645618252949463;
    this.sampleRate = 44100;
    this.minPitch = 55; // Минимальная частота (Гц) A1
    this.maxPitch = 1760; // Максимальная частота (Гц) A6
    this.bufferSize = 2048; // Увеличиваем размер буфера для более точного анализа

    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    this.rms = 0;
    this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  }



  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Заполняем буфер
    for (let i = 0; i < input[0].length; i++) {
      this.buffer[this.bufferIndex++] = input[0][i];

      if (this.bufferIndex >= this.bufferSize) {
        //this.detectPitch();
        let lastPitch = this.autoCorrelate();
        if ((lastPitch < this.minPitch) && (lastPitch != 0))
          lastPitch = this.minPitch;
        if (lastPitch > this.maxPitch)
          lastPitch = this.maxPitch;
        let note = this.noteFromPitch(lastPitch);
        let noteName = this.noteStrings[note % 12];
        let noteFreq = this.frequencyFromNoteNumber(note);
        let next_freq = ((noteFreq >= this.maxPitch) || (noteFreq <= this.minPitch)) ? 0 : noteFreq * this.SEMITONE_COEFF;
        let prev_freq = ((noteFreq >= this.maxPitch) || (noteFreq <= this.minPitch)) ? 0 : noteFreq / this.SEMITONE_COEFF;
        let noteFreq_plus30c = noteFreq * (1 + 30 * 0.000577);
        let noteFreq_minus30c = noteFreq * (1 - 30 * 0.000577);
        //console.log(this.note);
        this.port.postMessage({
          type: 'pitch',
          note_frequency: lastPitch,
          prev_note_frequency: prev_freq,
          next_note_frequency: next_freq,
          note_frequency_plus30c: noteFreq_plus30c,
          note_frequency_minus30c: noteFreq_minus30c,
          note_name: noteName,
          //rms: this.rms
        });
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  autoCorrelate() {
    // Implements the ACF2+ algorithm
    let SIZE = this.buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      let val = this.buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < this.RMS_TRESHOLD) { // not enough signal
      //this.lastPitch = 0;   
      this.rms = rms;
      return 0;
    }

    // let r1 = 0, r2 = SIZE-1, thres = this.THRESHOLD;
    // for (let i = 0; i < SIZE/2; i++)
    //   if (Math.abs(this.buffer[i]) < thres) { r1 = i; break; }
    // for (let i = 1; i < SIZE/2; i++)
    //   if (Math.abs(this.buffer[SIZE-i]) < thres) { r2 = SIZE - i; break; }

    // this.buffer = this.buffer.slice(r1, r2);
    // SIZE = this.buffer.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE - i; j++)
        c[i] = c[i] + this.buffer[j] * this.buffer[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    this.rms = rms;
    //this.lastPitch = sampleRate/T0;
    return sampleRate / T0;

  }

  noteFromPitch(frequency) {
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
  }

  frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }
}

registerProcessor('pitch-processor', PitchProcessor);