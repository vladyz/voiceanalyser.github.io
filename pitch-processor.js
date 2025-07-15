class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 44100;
    this.bufferSize = 1024; // Увеличиваем размер буфера для более точного анализа
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.THRESHOLD = 0.1; // Более строгий порог
    this.smoothingFactor = 0.8;
    this.lastPitch = 0;
    this.minPitch = 50; // Минимальная частота (Гц)
    this.maxPitch = 700; // Максимальная частота (Гц)
    this.RMS_TRESHOLD = 0.003;
    this.rms = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Заполняем буфер
    for (let i = 0; i < input[0].length; i++) {
      this.buffer[this.bufferIndex++] = input[0][i];
      
      if (this.bufferIndex >= this.bufferSize) {
        //this.detectPitch();
        this.autoCorrelate();
        if ((this.lastPitch <this.minPitch) || (this.lastPitch>this.maxPitch))
          this.lastPitch = 0;  
        this.port.postMessage({
          type: 'pitch',
          frequency: this.lastPitch,
          rms: this.rms
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
      rms += val*val;
    }
    rms = Math.sqrt(rms/SIZE);
    if (rms < this.RMS_TRESHOLD) { // not enough signal
      this.lastPitch = 0;   
      this.rms = rms;     
      return;
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
        c[i] = c[i] + this.buffer[j]*this.buffer[j + i];

    let d=0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2*x2)/2;
    let b = (x3 - x1)/2;
    if (a) T0 = T0 - b/(2*a);

    this.lastPitch = sampleRate/T0;
    this.rms = rms;
  }

//   detectPitch() {
//     // 1. Проверка уровня сигнала
//     const rms = this.calculateRMS(this.buffer);
//     if (rms < 0.01) return; // Пропускаем тихие участки

//     // 2. Применяем оконную функцию (Ханна)
//     const windowedBuffer = this.applyHannWindow(this.buffer);

//     // 3. Автокорреляционный метод с улучшениями
//     const pitchLag = this.autoCorrelationPitch(windowedBuffer);
    
//     if (pitchLag > 0) {
//       const rawFrequency = this.sampleRate / pitchLag;
      
//       // Фильтрация по допустимому диапазону
//       if (rawFrequency >= this.minPitch && rawFrequency <= this.maxPitch) {
//         // Сглаживание результатов
//         this.lastPitch = this.smoothingFactor * this.lastPitch + 
//                        (1 - this.smoothingFactor) * rawFrequency;
        
//         this.port.postMessage({
//           type: 'pitch',
//           frequency: this.lastPitch,
//           rms: rms
//         });
//       }
//     }
//   }

//   calculateRMS(buffer) {
//     let sum = 0;
//     for (let i = 0; i < buffer.length; i++) {
//       sum += buffer[i] * buffer[i];
//     }
//     return Math.sqrt(sum / buffer.length);
//   }

//   applyHannWindow(buffer) {
//     const windowed = new Float32Array(buffer.length);
//     for (let i = 0; i < buffer.length; i++) {
//       const multiplier = 0.5 * (1 - Math.cos(2 * Math.PI * i / (buffer.length - 1)));
//       windowed[i] = buffer[i] * multiplier;
//     }
//     return windowed;
//   }

//   autoCorrelationPitch(buffer) {
//     const correlations = new Float32Array(buffer.length / 2);
    
//     // Вычисляем автокорреляцию
//     for (let lag = 0; lag < correlations.length; lag++) {
//       let sum = 0;
//       for (let i = 0; i < buffer.length - lag; i++) {
//         sum += buffer[i] * buffer[i + lag];
//       }
//       correlations[lag] = sum;
//     }

//     // Находим первый пик с улучшенной логикой
//     return this.findBestPeak(correlations);
//   }

//   findBestPeak(correlations) {
//     // 1. Находим глобальный максимум
//     let maxCorr = 0;
//     for (let i = 0; i < correlations.length; i++) {
//       if (correlations[i] > maxCorr) {
//         maxCorr = correlations[i];
//       }
//     }

//     // 2. Ищем первый значимый пик
//     const minLag = Math.floor(this.sampleRate / this.maxPitch); // Минимальный лаг для maxPitch
//     const maxLag = Math.ceil(this.sampleRate / this.minPitch); // Максимальный лаг для minPitch
    
//     for (let lag = minLag; lag < Math.min(maxLag, correlations.length); lag++) {
//       if (correlations[lag] > maxCorr * this.THRESHOLD &&
//           correlations[lag] > correlations[lag - 1] &&
//           correlations[lag] > correlations[lag + 1]) {
//         // Уточняем позицию пика параболической интерполяцией
//         return this.parabolicInterpolation(correlations, lag);
//       }
//     }
    
//     return -1;
//   }

//   parabolicInterpolation(correlations, peakIndex) {
//     const alpha = correlations[peakIndex - 1];
//     const beta = correlations[peakIndex];
//     const gamma = correlations[peakIndex + 1];
    
//     return peakIndex + 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
//   }
}

registerProcessor('pitch-processor', PitchProcessor);