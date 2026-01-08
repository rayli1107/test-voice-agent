import { Directory, File, Paths } from 'expo-file-system';
import { AudioContext } from 'react-native-audio-api';
import { ResourceFetcher, SpeechToTextModelConfig } from 'react-native-executorch';

export class WhisperModel {
    private _modelConfig: SpeechToTextModelConfig;
    private _modelFolder: Directory;
    private _modelEncoderFile: File;
    private _modelDecoderFile: File;
    private _modelTokenizerFile: File;

    private _nativeModule: any;

    private _textDecoder = new TextDecoder(
        'utf-8', { fatal: false, ignoreBOM: true });

    constructor(modelConfig: SpeechToTextModelConfig, modelLabel: string) {
        this._modelConfig = modelConfig;
        this._modelFolder = new Directory(
            Paths.cache, 'models', modelLabel);
        this._modelEncoderFile = new File(
            this._modelFolder, 'encoder.pte');
        this._modelDecoderFile = new File(
            this._modelFolder, 'decoder.pte');
        this._modelTokenizerFile = new File(
            this._modelFolder, 'tokenizer.json');
    }

    public async initialize() {
        this._modelFolder.create({ idempotent: true, intermediates: true });

        await this.downloadFile(
            this._modelConfig.encoderSource.toString(),
            this._modelEncoderFile);

        await this.downloadFile(
            this._modelConfig.decoderSource.toString(),
            this._modelDecoderFile);

        await this.downloadFile(
            this._modelConfig.tokenizerSource.toString(),
            this._modelTokenizerFile);

        const encoderFile = (await ResourceFetcher.fetch(
            undefined,
            this._modelEncoderFile.uri))![0];
        const decoderFile = (await ResourceFetcher.fetch(
            undefined,
            this._modelDecoderFile.uri))![0];
        const tokenizerFile = (await ResourceFetcher.fetch(
            undefined,
            this._modelTokenizerFile.uri))![0];

        this._nativeModule = await global.loadSpeechToText(
            encoderFile, decoderFile, tokenizerFile);
        if (this._nativeModule === null || this._nativeModule === undefined) {
            throw new Error('Failed to load speech to text model');
        }
        const fn = this._nativeModule.transcribe;
        console.log('Whisper Model Loaded');
    }

    public async release() {
        this._nativeModule.unload();
    }

    public async transcribe(uri: string, language: string = ''): Promise<string> {
        console.log(`transcribe [${language}]: ${uri}`);

        language = this._modelConfig.isMultilingual ? (language || 'en') : '';
        console.log(`transcribe fetching...`);

        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        console.log(`transcribe getting audio buffer...`);

        const audioContext = new AudioContext({ sampleRate: 16000 });
        const decodedAudioData = await audioContext.decodeAudioData(arrayBuffer);
        const audioBuffer = decodedAudioData.getChannelData(0);

        console.log(`transcribe running model...`);
        const transcriptionBytes = await this._nativeModule.transcribe(
            audioBuffer, language);

        console.log(`transcribe decoding...`);

        return this._textDecoder.decode(new Uint8Array(transcriptionBytes));
    }

    private async downloadFile(url: string, file: File) {
        if (file.exists) {
            console.log('file exists: ' + file.uri);
            return;
        }

        console.log('downloading: ' + url + ' to ' + file.uri);
        try {
            await File.downloadFileAsync(url, file);
            console.log('downloaded: ' + file.uri);
        }
        catch (error) {
            console.error('downloadFile ' + url + ' Error:', error);
        }
    }
}
