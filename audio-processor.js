// audio-processor.js
class AudioVisualizerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        const DEC_CHUNK_SIZE = 128;
        const DEC_FACTOR = 32;
        this.decchunkSize = DEC_CHUNK_SIZE; // Размер выходного блока
        this.decimationFactor = DEC_FACTOR; // Коэффициент децимации
        this.rawchunkSize = DEC_CHUNK_SIZE * DEC_FACTOR; // Размер выходного блока

        this.decbuffer = new Float32Array(this.decchunkSize * 4); // Буфер с запасом
        //this.rawbuffer = new Float32Array(this.rawchunkSize * 4); // Буфер с запасом
        //this.rawbufferIndex = 0;
        this.decbufferIndex = 0;

        this.port.onmessage = (event) => {
            if (event.data === 'getConfig') {
                this.port.postMessage({
                    decchunkSize: this.decchunkSize,
                    sampleRate: sampleRate / this.decimationFactor
                });
            }
        };
    }

    process(inputs) {
        const input = inputs[0];
        if (!input?.[0]) return true;

        const inputData = input[0];
        const outputLength = inputData.length;//Math.floor(inputData.length / this.decimationFactor);

        // Быстрая децимация через прямое копирование
        for (let i = 0; i < outputLength; i = i + this.decimationFactor) {
            //this.rawbuffer[this.rawbufferIndex++] = inputData[i];

            // 2. Децимация 
            this.decbuffer[this.decbufferIndex++] = inputData[i];

            if (this.decbufferIndex >= this.decchunkSize) {
                this.port.postMessage({
                    decsamples: this.decbuffer.slice(0, this.decchunkSize),
                    //rawsamples: this.rawbuffer.slice(0, this.rawchunkSize)
                }, [this.decbuffer.buffer/*, this.rawbuffer.buffer*/]);

                // Создаем новый буфер вместо очистки
                this.decbuffer = new Float32Array(this.decchunkSize * 4);
                this.decbufferIndex = 0;
                // this.rawbuffer = new Float32Array(this.rawchunkSize * 4);
                // this.rawbufferIndex = 0;
            }
        }

        return true;
    }


}

registerProcessor('audio-visualizer-processor', AudioVisualizerProcessor);