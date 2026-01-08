import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder
} from 'expo-audio';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { WHISPER_BASE } from 'react-native-executorch';
import { WhisperModel } from '../../utils/whisper-model';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

const VoiceChat = () => {
    const queryURL = 'http://localhost:5678/webhook-test/c9afcfa9-3051-4859-99ae-97fe322c2199';
    const colorScheme = useColorScheme();
    const [isRecording, setIsRecording] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '你好! How can I assist you today?',
            isUser: false,
            timestamp: new Date(),
        },
    ]);

    const whisperModel = new WhisperModel(WHISPER_BASE, 'whisper-base');
    useEffect(
        () => {
            whisperModel.initialize();
            return () => { whisperModel.release(); };
        },
        []);

    const recorder = useAudioRecorder(
        RecordingPresets.HIGH_QUALITY,
        (status) => console.log('Recording status:', status)
    );

    const startRecording = async () => {
        try {
            const response = await requestRecordingPermissionsAsync();
            if (!response.granted) {
                Alert.alert('Permission not granted');
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true
            });

            await recorder.prepareToRecordAsync();
            recorder.record();
        } catch (error) {
            console.error('startRecording() Error:', error);
        }
    }

    const stopRecording = async (): Promise<string> => {
        await recorder.stop();
        return whisperModel.transcribe(recorder.uri!, 'zh');
    }

    const addUserMessage = (message: string) => {
        console.log('userMessage: ', message);
        const userMessage: Message = {
            id: Date.now().toString(),
            text: message,
            isUser: true,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
    }

    const addAgentMessage = (message: string) => {
        console.log('agentMessage: ', message);
        const agentMessage: Message = {
            id: Date.now().toString(),
            text: message,
            isUser: false,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
    }

    const processUserInput = async (message: string) => {
        addUserMessage(message);

        const request: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'message': message })
        }

        try {
            const response = await fetch(queryURL, request);
            if (!response.ok) {
                throw new Error(response.statusText);
            }

            const data = await response.json();
            console.log('Response: ', data);
        }
        catch (error) {
            console.error('fetch() Error: ', error);
            return;
        }
    }

    const handleRecordPress = async () => {
        setIsRecording(!isRecording);

        // Simulate adding a user message when recording stops
        if (isRecording) {
            stopRecording().then(processUserInput);
            /*
                            const userMessage: Message = {
                                id: Date.now().toString(),
                                text: 'This is a voice message transcription',
                                sender: 'user',
                                timestamp: new Date(),
                            };
                
                            setMessages(prev => [...prev, userMessage]);
                
                            // Simulate agent response
                            setTimeout(() => {
                                const agentMessage: Message = {
                                    id: (Date.now() + 1).toString(),
                                    text: 'I understand. Let me help you with that.',
                                    sender: 'agent',
                                    timestamp: new Date(),
                                };
                                setMessages(prev => [...prev, agentMessage]);
                            }, 1000);
                            */
        }
        else {
            startRecording();
        }
    };

    const colors = Colors[colorScheme ?? 'light'];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Chat Messages Area */}
            <ScrollView
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.map((message) => (
                    <View
                        key={message.id}
                        style={message.isUser ?
                            styles.messageBubbleUser :
                            styles.messageBubbleAgent}>
                        <Text style={styles.messageText}>
                            {message.text}
                        </Text>
                        <Text style={styles.timestamp}>
                            {message.timestamp.toLocaleTimeString(
                                [], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                ))}
            </ScrollView>

            {/* Record Button Area */}
            <View style={[styles.recordContainer, { borderTopColor: colorScheme === 'dark' ? '#2C2C2E' : '#E5E5EA' }]}>
                <TouchableOpacity
                    style={[
                        styles.recordButton,
                        {
                            backgroundColor: isRecording ? '#FF3B30' : colors.tint,
                        },
                    ]}
                    onPress={handleRecordPress}
                    activeOpacity={0.8}
                >
                    <IconSymbol
                        size={32}
                        name={isRecording ? 'stop.circle.fill' : 'mic.fill'}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
                <Text style={[styles.recordText, { color: colors.text }]}>
                    {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
                </Text>
            </View>
        </View>
    );
};

export default VoiceChat;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 8,
    },
    messageBubbleUser: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 18,
        marginBottom: 12,
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
        backgroundColor: '#2C2C2E',
    },
    messageBubbleAgent: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 18,
        marginBottom: 12,
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        backgroundColor: '#2C2C2E',
        /*
        backgroundColor: message.sender === 'user'
            ? colors.tint
            : colorScheme === 'dark' ? '#2C2C2E' : '#E5E5EA',
        */
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        color: '#FFFFFF',
        fontFamily: Platform.select(
            { android: 'NotoSansSC_500Medium', ios: 'NotoSansSC-Medium' })
    },
    timestamp: {
        fontSize: 11,
        marginTop: 4,
        color: 'rgba(255, 255, 255, 0.5)'
        /*
        message.sender === 'user' ?
        'rgba(255, 255, 255, 0.7)' :
        colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',*/
    },
    recordContainer: {
        padding: 20,
        paddingBottom: 32,
        borderTopWidth: 1,
        alignItems: 'center',
        gap: 12,
    },
    recordButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    recordText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
